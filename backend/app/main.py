from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import analytics, evaluation, moderations, policies, reviews

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    description="Explainable content classification with deterministic policy enforcement.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(moderations.router, prefix="/api")
app.include_router(policies.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
