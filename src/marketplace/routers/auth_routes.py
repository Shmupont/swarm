from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import create_jwt, get_current_user, hash_password, verify_password
from ..database import get_session
from ..models import User
from ..schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse, UserUpdate, UserTypeUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register_user(
    data: RegisterRequest,
    session: Session = Depends(get_session),
):
    existing = session.exec(
        select(User).where(User.email == data.email.lower())
    ).first()
    if existing:
        raise HTTPException(409, "Email already registered")

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        display_name=data.display_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_jwt(str(user.id), user.email)
    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
def login_user(
    data: LoginRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.email == data.email.lower())
    ).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_jwt(str(user.id), user.email)
    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserResponse.model_validate(user)


@router.patch("/me/type", response_model=UserResponse)
def set_user_type(
    data: UserTypeUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    user.user_type = data.user_type
    user.onboarding_completed = True
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserResponse.model_validate(user)
