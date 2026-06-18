from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ModerationResult, PlatformPolicy
from app.repositories.repositories import AnalyticsRepository, ModerationRepository
from app.schemas.api import DashboardResponse
from app.services.moderation import serialize_result

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    analytics = AnalyticsRepository(db)
    categories = analytics.grouped(ModerationResult.top_category)
    platforms = analytics.grouped(ModerationResult.platform_id)
    policy_names = {policy.id: policy.name for policy in db.query(PlatformPolicy).all()}
    items = ModerationRepository(db).list(500)
    buckets = [
        {"name": "0-.2", "min": 0, "max": 0.2, "count": 0},
        {"name": ".2-.4", "min": 0.2, "max": 0.4, "count": 0},
        {"name": ".4-.6", "min": 0.4, "max": 0.6, "count": 0},
        {"name": ".6-.8", "min": 0.6, "max": 0.8, "count": 0},
        {"name": ".8-1", "min": 0.8, "max": 1.01, "count": 0},
    ]
    for item in items:
        next(bucket for bucket in buckets if bucket["min"] <= item.confidence < bucket["max"])[
            "count"
        ] += 1
    return DashboardResponse(
        metrics=analytics.metrics(),
        category_distribution=[{"name": name, "value": count} for name, count in categories],
        platform_distribution=[
            {"name": policy_names.get(policy_id, "Unknown"), "value": count}
            for policy_id, count in platforms
        ],
        confidence_distribution=[
            {"name": bucket["name"], "value": bucket["count"]} for bucket in buckets
        ],
        recent_activity=[serialize_result(item) for item in items[:8]],
    )
