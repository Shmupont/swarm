import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .config import get_settings
from .database import get_session
from .models import User

ph = PasswordHasher()
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = timedelta(hours=24)


# ── Password helpers ─────────────────────────────────────────────────


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return ph.verify(password_hash, password)
    except Exception:
        return False


# ── JWT helpers ──────────────────────────────────────────────────────


def create_jwt(user_id: str, email: str) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(UTC) + JWT_EXPIRATION,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])


# ── FastAPI dependencies ─────────────────────────────────────────────


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    session: Session = Depends(get_session),
) -> User:
    """Authenticate via JWT (Bearer eyJ...)."""
    token = credentials.credentials
    try:
        payload = decode_jwt(token)
        user = session.get(User, uuid.UUID(payload["sub"]))
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Security(optional_security),
    session: Session = Depends(get_session),
) -> User | None:
    """Returns User if valid JWT provided, None otherwise."""
    if not credentials:
        return None
    try:
        payload = decode_jwt(credentials.credentials)
        return session.get(User, uuid.UUID(payload["sub"]))
    except Exception:
        return None
