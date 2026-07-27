"""
Security primitives: password hashing (bcrypt, called directly) and
JWT access/refresh token creation & verification.

NOTE: password hashing intentionally does NOT go through passlib.
passlib==1.7.4's bcrypt backend reads `bcrypt.__about__.__version__`,
an attribute bcrypt>=4.1 removed. That mismatch doesn't raise loudly —
it makes passlib's CryptContext.verify() silently return False for
every password while hash() keeps working, so registration succeeds
but login always fails with "Invalid email or password". Calling
bcrypt directly avoids that landmine entirely.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ---------- Password hashing ----------
# bcrypt has a hard 72-byte input limit and raises on longer input
# (passlib used to truncate silently) — truncate here so long
# passwords don't crash registration/login instead of just being
# less effective past 72 bytes, same practical behavior either way.
def _bcrypt_safe_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_bcrypt_safe_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(_bcrypt_safe_bytes(plain_password), hashed_password.encode("utf-8"))
    except ValueError:
        # Malformed/legacy hash (e.g. old passlib-produced hash) — treat as no match.
        return False


# ---------- JWT ----------
def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str, remember_me: bool = False) -> tuple[str, datetime]:
    days = (
        settings.REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER_ME
        if remember_me
        else settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    expire = datetime.now(timezone.utc) + timedelta(days=days)
    jti = str(uuid.uuid4())
    payload = {"sub": subject, "exp": expire, "type": "refresh", "jti": jti}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expire


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
