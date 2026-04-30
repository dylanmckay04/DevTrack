from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import httpx
from app.config import settings
from app.core.dependencies import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token, create_socket_token, SOCKET_TOKEN_EXPIRE_SECONDS
from app.core.limiter import limiter
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, Token, SocketToken
from app.services.socket_tokens import socket_token_store

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=user_in.email, hashed_password=hash_password(user_in.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/socket-token", response_model=SocketToken)
def get_socket_token(current_user: User = Depends(get_current_user)):
    token, jti = create_socket_token({"sub": str(current_user.id)})
    socket_token_store.remember(jti, current_user.id, SOCKET_TOKEN_EXPIRE_SECONDS)
    return {
        "socket_token": token,
        "token_type": "socket",
        "expires_in": SOCKET_TOKEN_EXPIRE_SECONDS,
    }


@router.get("/github")
def github_login():
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_REDIRECT_URI:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured")
    params = urlencode({
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "user:email",
    })
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


async def _get_github_primary_email(gh_token: str) -> str | None:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/json"},
        )
    for entry in res.json():
        if entry.get("primary") and entry.get("verified"):
            return entry["email"]
    return None


@router.get("/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
    gh_token = token_res.json().get("access_token")
    if not gh_token:
        raise HTTPException(status_code=400, detail="GitHub OAuth failed")

    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/json"},
        )
    gh_user = user_res.json()
    github_id = str(gh_user["id"])

    email = gh_user.get("email") or await _get_github_primary_email(gh_token)
    if not email:
        raise HTTPException(status_code=400, detail="GitHub account has no verified email")

    user = db.query(User).filter(User.github_id == github_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.github_id = github_id
        else:
            user = User(email=email, github_id=github_id)
            db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/github/callback?token={token}")
