"""
MongoDB connection layer (Motor async driver).

Exposes a single AsyncIOMotorClient/Database pair reused across the
app, plus a `connect_to_mongo` / `close_mongo_connection` pair called
from FastAPI's lifespan handler in main.py.
"""
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


class MongoDB:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongodb = MongoDB()


async def connect_to_mongo() -> None:
    logger.info("Connecting to MongoDB at {}", settings.MONGODB_URI)
    mongodb.client = AsyncIOMotorClient(settings.MONGODB_URI)
    mongodb.db = mongodb.client[settings.MONGO_DB_NAME]
    await _ensure_indexes(mongodb.db)
    logger.success("MongoDB connection established")


async def close_mongo_connection() -> None:
    if mongodb.client:
        mongodb.client.close()
        logger.info("MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency: returns the shared database handle."""
    return mongodb.db


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Creates indexes required for correctness/perf. Idempotent."""
    await db.users.create_index("email", unique=True)
    await db.refresh_tokens.create_index("token", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.shelters.create_index([("location", "2dsphere")])
    await db.emergency_services.create_index([("location", "2dsphere")])
    await db.alerts.create_index("created_at")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.chat_history.create_index([("user_id", 1), ("created_at", -1)])
    await db.weather_cache.create_index("expires_at", expireAfterSeconds=0)
    await db.uploads.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("MongoDB indexes ensured")
