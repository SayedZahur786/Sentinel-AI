import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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


@app.exception_handler(httpx.HTTPStatusError)
async def upstream_ai_error_handler(request: Request, exc: httpx.HTTPStatusError) -> JSONResponse:
    """Turn an upstream AI provider failure into a clean, CORS-friendly JSON error.

    Without this, the raw exception becomes a bare 500 from the outer error
    middleware (outside CORS), which browsers surface as an opaque "failed to fetch".
    """
    status = exc.response.status_code
    detail = f"AI provider returned HTTP {status}"
    try:
        detail = exc.response.json().get("error", {}).get("message", detail)
    except Exception:
        pass
    return JSONResponse(status_code=502, content={"detail": f"AI provider error: {detail}"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
