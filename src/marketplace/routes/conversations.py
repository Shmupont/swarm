from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, col

from ..database import get_session
from ..models import Conversation, Message, AgentProfile, User, utcnow
from ..auth import get_current_user

router = APIRouter(prefix="/conversations", tags=["conversations"])


def conversation_to_dict(c: Conversation, session: Session, current_user_id: str) -> dict:
    agent = session.get(AgentProfile, c.agent_profile_id)
    other_id = c.owner_id if c.initiator_id == current_user_id else c.initiator_id
    other_user = session.get(User, other_id) if other_id else None

    # Get unread count
    unread = 0
    msgs = session.exec(
        select(Message)
        .where(Message.conversation_id == c.id, Message.sender_id != current_user_id, Message.is_read == False)
    ).all()
    unread = len(msgs)

    # Last message preview
    last_msg = session.exec(
        select(Message)
        .where(Message.conversation_id == c.id)
        .order_by(col(Message.created_at).desc())
        .limit(1)
    ).first()

    return {
        "id": c.id,
        "agent_profile_id": c.agent_profile_id,
        "initiator_id": c.initiator_id,
        "owner_id": c.owner_id,
        "subject": c.subject,
        "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
        "is_read_by_owner": c.is_read_by_owner,
        "is_read_by_initiator": c.is_read_by_initiator,
        "created_at": c.created_at.isoformat(),
        "agent_name": agent.name if agent else None,
        "agent_avatar_url": agent.avatar_url if agent else None,
        "other_party_name": other_user.display_name or other_user.email if other_user else None,
        "last_message_preview": last_msg.content[:100] if last_msg else None,
        "unread_count": unread,
    }


class StartConversationRequest(BaseModel):
    agent_profile_id: str
    subject: str | None = None
    message: str


class SendMessageRequest(BaseModel):
    content: str


@router.get("")
def list_conversations(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    convos = session.exec(
        select(Conversation)
        .where((Conversation.initiator_id == user.id) | (Conversation.owner_id == user.id))
        .order_by(col(Conversation.last_message_at).desc().nullslast())
    ).all()
    return [conversation_to_dict(c, session, user.id) for c in convos]


@router.post("")
def start_conversation(
    body: StartConversationRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, body.agent_profile_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    now = utcnow()
    conv = Conversation(
        agent_profile_id=body.agent_profile_id,
        initiator_id=user.id,
        owner_id=agent.owner_id,
        subject=body.subject,
        last_message_at=now,
        is_read_by_initiator=True,
        is_read_by_owner=False,
    )
    session.add(conv)
    session.flush()

    msg = Message(
        conversation_id=conv.id,
        sender_id=user.id,
        content=body.message,
    )
    session.add(msg)
    session.commit()
    session.refresh(conv)

    return conversation_to_dict(conv, session, user.id)


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.initiator_id != user.id and conv.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your conversation")

    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(col(Message.created_at).asc())
    ).all()

    return {
        "conversation": conversation_to_dict(conv, session, user.id),
        "messages": [
            {
                "id": m.id,
                "conversation_id": m.conversation_id,
                "sender_id": m.sender_id,
                "content": m.content,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/{conversation_id}/messages")
def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.initiator_id != user.id and conv.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your conversation")

    now = utcnow()
    msg = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        content=body.content,
    )
    session.add(msg)

    conv.last_message_at = now
    if user.id == conv.initiator_id:
        conv.is_read_by_owner = False
        conv.is_read_by_initiator = True
    else:
        conv.is_read_by_initiator = False
        conv.is_read_by_owner = True

    session.add(conv)
    session.commit()
    session.refresh(msg)

    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat(),
    }


@router.patch("/{conversation_id}/read")
def mark_read(
    conversation_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if user.id == conv.owner_id:
        conv.is_read_by_owner = True
    elif user.id == conv.initiator_id:
        conv.is_read_by_initiator = True

    # Mark individual messages as read
    unread = session.exec(
        select(Message).where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user.id,
            Message.is_read == False,
        )
    ).all()
    for m in unread:
        m.is_read = True
        session.add(m)

    session.add(conv)
    session.commit()
    return {"ok": True}
