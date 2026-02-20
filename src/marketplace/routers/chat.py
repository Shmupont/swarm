import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AgentProfile, AgentSession, AgentChatMessage, User, _utcnow
from ..schemas import (
    SessionResponse,
    ChatSendMessageRequest,
    ChatMessageResponse,
    ChatResponse,
)
from ..llm import call_agent

router = APIRouter(tags=["chat"])


def _session_response(s: AgentSession, agent: AgentProfile | None) -> SessionResponse:
    return SessionResponse(
        id=s.id,
        agent_profile_id=s.agent_profile_id,
        user_id=s.user_id,
        title=s.title,
        is_active=s.is_active,
        total_messages=s.total_messages,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
        agent_name=agent.name if agent else None,
        agent_slug=agent.slug if agent else None,
        agent_avatar_url=agent.avatar_url if agent else None,
    )


def _msg_response(msg: AgentChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=msg.id,
        session_id=msg.session_id,
        role=msg.role,
        content=msg.content,
        tokens_used=msg.tokens_used,
        model_used=msg.model_used,
        created_at=msg.created_at.isoformat(),
    )


@router.post("/agents/{slug}/sessions", response_model=SessionResponse, status_code=201)
def start_session(
    slug: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.exec(
        select(AgentProfile).where(AgentProfile.slug == slug)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if not agent.system_prompt:
        raise HTTPException(400, "This agent is not configured for chat yet")
    if not agent.has_api_key or not agent.encrypted_api_key:
        raise HTTPException(400, "This agent is not configured for chat yet")

    chat_session = AgentSession(
        agent_profile_id=agent.id,
        user_id=user.id,
    )
    session.add(chat_session)
    session.commit()
    session.refresh(chat_session)
    return _session_response(chat_session, agent)


@router.post("/sessions/{session_id}/messages", response_model=ChatResponse)
def send_message(
    session_id: uuid.UUID,
    data: ChatSendMessageRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat_session = session.get(AgentSession, session_id)
    if not chat_session:
        raise HTTPException(404, "Session not found")
    if chat_session.user_id != user.id:
        raise HTTPException(403, "Not your session")
    if not chat_session.is_active:
        raise HTTPException(400, "Session is closed")

    agent = session.get(AgentProfile, chat_session.agent_profile_id)
    if not agent or not agent.encrypted_api_key or not agent.system_prompt:
        raise HTTPException(400, "Agent is not properly configured")

    user_msg = AgentChatMessage(
        session_id=chat_session.id,
        role="user",
        content=data.content,
        tokens_used=0,
    )
    session.add(user_msg)
    session.flush()

    history = session.exec(
        select(AgentChatMessage)
        .where(AgentChatMessage.session_id == chat_session.id)
        .order_by(AgentChatMessage.created_at.asc())
    ).all()

    messages = [{"role": msg.role, "content": msg.content} for msg in history]

    try:
        result = call_agent(
            encrypted_api_key=agent.encrypted_api_key,
            system_prompt=agent.system_prompt,
            messages=messages,
            model=agent.llm_model,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
        )
    except Exception as e:
        session.commit()
        raise HTTPException(502, f"Agent failed to respond: {str(e)}")

    assistant_msg = AgentChatMessage(
        session_id=chat_session.id,
        role="assistant",
        content=result["content"],
        tokens_used=result["tokens_used"],
        model_used=result["model"],
    )
    session.add(assistant_msg)

    chat_session.total_messages += 2
    chat_session.total_tokens_used += result["tokens_used"]
    chat_session.updated_at = _utcnow()

    if chat_session.title is None:
        chat_session.title = data.content[:80] + ("..." if len(data.content) > 80 else "")

    session.add(chat_session)
    session.commit()
    session.refresh(user_msg)
    session.refresh(assistant_msg)

    return ChatResponse(
        user_message=_msg_response(user_msg),
        assistant_message=_msg_response(assistant_msg),
    )


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat_session = session.get(AgentSession, session_id)
    if not chat_session:
        raise HTTPException(404, "Session not found")
    if chat_session.user_id != user.id:
        raise HTTPException(403, "Not your session")

    agent = session.get(AgentProfile, chat_session.agent_profile_id)
    messages = session.exec(
        select(AgentChatMessage)
        .where(AgentChatMessage.session_id == chat_session.id)
        .order_by(AgentChatMessage.created_at.asc())
    ).all()

    return {
        "session": _session_response(chat_session, agent),
        "messages": [_msg_response(m) for m in messages],
    }


@router.get("/sessions", response_model=list[SessionResponse])
def list_my_sessions(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    sessions = session.exec(
        select(AgentSession)
        .where(AgentSession.user_id == user.id)
        .order_by(AgentSession.updated_at.desc())
    ).all()

    result = []
    for s in sessions:
        agent = session.get(AgentProfile, s.agent_profile_id)
        result.append(_session_response(s, agent))
    return result
