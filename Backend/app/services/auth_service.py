"""
Auth service: owns all business logic for registration, login,
refresh-token rotation, and logout. Routers stay thin and only
translate HTTP <-> service calls.
"""
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import new_user_document
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair


async def register_user(db: AsyncIOMotorDatabase, payload: RegisterRequest) -> dict:
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    doc = new_user_document(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        phone=payload.phone,
    )
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("New user registered: {}", payload.email)
    return doc


async def authenticate_user(db: AsyncIOMotorDatabase, payload: LoginRequest) -> dict:
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("hashed_password"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")
    return user


async def issue_token_pair(db: AsyncIOMotorDatabase, user_id: str, remember_me: bool = False) -> TokenPair:
    access_token = create_access_token(subject=user_id)
    refresh_token, expires_at = create_refresh_token(subject=user_id, remember_me=remember_me)

    await db.refresh_tokens.insert_one(
        {
            "token": refresh_token,
            "user_id": ObjectId(user_id),
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "revoked": False,
        }
    )

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def refresh_access_token(db: AsyncIOMotorDatabase, refresh_token: str) -> TokenPair:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    stored = await db.refresh_tokens.find_one({"token": refresh_token})
    if not stored or stored.get("revoked"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has been revoked")

    # Rotate: revoke the old token, issue a brand new pair.
    await db.refresh_tokens.update_one({"_id": stored["_id"]}, {"$set": {"revoked": True}})
    return await issue_token_pair(db, str(payload["sub"]))


async def revoke_refresh_token(db: AsyncIOMotorDatabase, refresh_token: str) -> None:
    await db.refresh_tokens.update_one({"token": refresh_token}, {"$set": {"revoked": True}})


async def revoke_all_user_tokens(db: AsyncIOMotorDatabase, user_id: str) -> None:
    await db.refresh_tokens.update_many({"user_id": ObjectId(user_id)}, {"$set": {"revoked": True}})


# ---------- Forgot password / email verification architecture ----------
# Full implementations require an SMTP or transactional-email provider.
# The flow below is wired end-to-end except for the actual send step,
# which logs instead of emailing until SMTP_* settings are configured.

async def request_password_reset(db: AsyncIOMotorDatabase, email: str) -> None:
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        # Do not reveal whether the email exists.
        return
    reset_token = str(uuid.uuid4())
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token, "reset_token_created_at": datetime.now(timezone.utc)}},
    )
    if settings.SMTP_HOST:
        # TODO: send via configured SMTP provider.
        pass
    logger.info("Password reset requested for {} — token: {}", email, reset_token)


async def reset_password(db: AsyncIOMotorDatabase, token: str, new_password: str) -> None:
    user = await db.users.find_one({"reset_token": token})
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"hashed_password": hash_password(new_password)},
            "$unset": {"reset_token": "", "reset_token_created_at": ""},
        },
    )
    await revoke_all_user_tokens(db, str(user["_id"]))


# ---------- Google login architecture ----------
# Full implementation verifies `id_token` against Google's public keys
# (google-auth library) and upserts a user with auth_provider="google".

async def authenticate_google_user(db: AsyncIOMotorDatabase, id_token: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            "Google login isn't configured on this server yet — set GOOGLE_CLIENT_ID in .env",
        )

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        claims = google_id_token.verify_oauth2_token(
            id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google sign-in token") from exc

    email = claims.get("email")
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google account has no email on file")
    if not claims.get("email_verified", False):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google email is not verified")

    user = await db.users.find_one({"email": email.lower()})
    if user:
        return user

    name = claims.get("name") or email.split("@")[0]
    doc = new_user_document(
        name=name,
        email=email,
        hashed_password=None,
        auth_provider="google",
    )
    doc["is_verified"] = True
    doc["avatar_url"] = claims.get("picture", "")
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("New user registered via Google: {}", email)
    return doc
