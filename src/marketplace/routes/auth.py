from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from ..database import get_session
from ..models import User
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user: dict


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    created_at: str


def user_to_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "created_at": u.created_at.isoformat(),
    }


@router.post("/register")
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id)
    return {"access_token": token, "user": user_to_dict(user)}


@router.post("/login")
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return {"access_token": token, "user": user_to_dict(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_to_dict(user)
