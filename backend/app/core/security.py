import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import bcrypt
from jose import jwt, JWTError
from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
SOCKET_TOKEN_EXPIRE_SECONDS = 60
VERIFICATION_TOKEN_EXPIRE_HOURS = 24
VERIFICATION_TOKEN_TYPE = "verification"


def _prehash(password: str) -> bytes:
    # SHA-256 prehash removes bcrypt's 72-byte input limit
    return hashlib.sha256(password.encode()).digest()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prehash(plain), hashed.encode())


def _create_signed_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "token_type": token_type})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
    return _create_signed_token(
        data,
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_socket_token(data: dict) -> tuple[str, str]:
    jti = uuid4().hex
    token = _create_signed_token(
        {**data, "jti": jti},
        timedelta(seconds=SOCKET_TOKEN_EXPIRE_SECONDS),
        "socket",
    )
    return token, jti


def _decode_token(token: str, expected_type: str) -> dict:
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("token_type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


def decode_access_token(token: str) -> dict:
    return _decode_token(token, "access")


def decode_socket_token(token: str) -> dict:
    return _decode_token(token, "socket")


def create_verification_token(user_id: int) -> str:
    """Creates a verification token for a user_id."""
    return _create_signed_token(
        {"sub": str(user_id)},
        timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS),
        VERIFICATION_TOKEN_TYPE,
    )


def decode_verification_token(token: str) -> int:
    """Returns user_id or raises HTTPException 400."""
    from fastapi import HTTPException
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("token_type") != VERIFICATION_TOKEN_TYPE:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")