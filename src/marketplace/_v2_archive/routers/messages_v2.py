import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, func, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AgentProfile, Conversation, Message, User
from ..schemas import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)

router = APIRouter(prefix="/conversations", tags=["messages"])


def _enrich_conversation(
    conv: Conversation, current_user: User, session: Session
) -> ConversationResponse:
    resp = ConversationResponse.model_validate(conv)

    agent = session.get(AgentProfile, conv.agent_profile_id)
    resp.agent_name = agent.name if agent else None

    other_id = conv.owner_id if conv.initiator_id == current_user.id else conv.initiator_id
    other_user = session.get(User, other_id)
    resp.other_user_name = (other_user.display_name or other_user.email) if other_user else None

    last_msg = session.exec(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(col(Message.created_at).desc())
        .limit(1)
    ).first()
    if last_msg:
        resp.last_message_preview = last_msg.content[:100]

    unread = session.exec(
        select(func.count(Message.id)).where(
            Message.conversation_id == conv.id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        )
    ).one()
    resp.unread_count = unread

    return resp


# ── Create conversation ──────────────────────────────────────────────


@router.post("", response_model=ConversationResponse, status_code=201)
def create_conversation(
    data: ConversationCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, data.agent_profile_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    conv = Conversation(
        agent_profile_id=agent.id,
        initiator_id=user.id,
        owner_id=agent.owner_id,
        subject=data.subject,
        last_message_at=datetime.now(UTC).replace(tzinfo=None),
    )
    session.add(conv)
    session.flush()

    msg = Message(
        conversation_id=conv.id,
        sender_id=user.id,
        content=data.initial_message,
    )
    session.add(msg)
    session.commit()
    session.refresh(conv)

    return _enrich_conversation(conv, user, session)


# ── List conversations ───────────────────────────────────────────────


@router.get("", response_model=list[ConversationResponse])
def list_conversations(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    convs = session.exec(
        select(Conversation)
        .where(
            (Conversation.initiator_id == user.id) | (Conversation.owner_id == user.id)
        )
        .order_by(col(Conversation.last_message_at).desc())
    ).all()
    return [_enrich_conversation(c, user, session) for c in convs]


# ── Get conversation with messages ───────────────────────────────────


@router.get("/{id}", response_model=dict)
def get_conversation(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if conv.initiator_id != user.id and conv.owner_id != user.id:
        raise HTTPException(403, "Not a participant")

    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == id)
        .order_by(col(Message.created_at).asc())
    ).all()

    msg_responses = []
    for m in messages:
        resp = MessageResponse.model_validate(m)
        sender = session.get(User, m.sender_id)
        resp.sender_name = (sender.display_name or sender.email) if sender else None
        msg_responses.append(resp)

    return {
        "conversation": _enrich_conversation(conv, user, session),
        "messages": msg_responses,
    }


# ── Send message ─────────────────────────────────────────────────────


@router.post("/{id}/messages", response_model=MessageResponse, status_code=201)
def send_message(
    id: uuid.UUID,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if conv.initiator_id != user.id and conv.owner_id != user.id:
        raise HTTPException(403, "Not a participant")

    msg = Message(
        conversation_id=conv.id,
        sender_id=user.id,
        content=data.content,
    )
    session.add(msg)

    conv.last_message_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(conv)
    session.commit()
    session.refresh(msg)

    resp = MessageResponse.model_validate(msg)
    resp.sender_name = user.display_name or user.email
    return resp


# ── Mark as read ─────────────────────────────────────────────────────


@router.patch("/{id}/read", status_code=204)
def mark_read(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if conv.initiator_id != user.id and conv.owner_id != user.id:
        raise HTTPException(403, "Not a participant")

    unread = session.exec(
        select(Message).where(
            Message.conversation_id == id,
            Message.sender_id != user.id,
            Message.is_read == False,
        )
    ).all()

    for m in unread:
        m.is_read = True
        session.add(m)

    session.commit()
