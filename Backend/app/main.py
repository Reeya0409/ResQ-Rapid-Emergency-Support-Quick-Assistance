from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.database import close_mongo_connection, connect_to_mongo, mongodb
from app.core.dependencies import limiter
from app.middleware.error_handler import register_exception_handlers
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.routers import (
    alerts,
    auth,
    chatbot,
    dashboard,
    emergency_contacts,
    emergency_services,
    guides,
    nearby,
    notifications,
    shelters,
    uploads,
    users,
    weather,
)
from app.services.alert_service import seed_alerts_if_empty
from app.services.emergency_service_service import seed_services_if_empty
from app.services.guide_service import seed_guides_if_empty
from app.services.shelter_service import seed_shelters_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    # Seed reference/mock collections so the frontend has real data to render.
    await seed_shelters_if_empty(mongodb.db)
    await seed_services_if_empty(mongodb.db)
    await seed_guides_if_empty(mongodb.db)
    await seed_alerts_if_empty(mongodb.db)
    yield
    await close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for ResQ — AI-powered disaster response assistant.",
    version="1.0.0",
    lifespan=lifespan,
)

# --- Rate limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Logging ---
app.add_middleware(RequestLoggingMiddleware)

# --- Error handling (standard envelope for all errors) ---
register_exception_handlers(app)

# --- Routers ---
for router in (
    auth.router,
    users.router,
    dashboard.router,
    weather.router,
    nearby.router,
    shelters.router,
    emergency_services.router,
    emergency_contacts.router,
    chatbot.router,
    uploads.router,
    guides.router,
    alerts.router,
    notifications.router,
):
    app.include_router(router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"success": True, "message": "ResQ API is running", "data": {"status": "healthy"}}
