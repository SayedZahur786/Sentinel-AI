from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.repositories import PolicyRepository
from app.schemas.api import PolicyResponse, PolicyUpdate, RoutingPreview
from app.services.policy_engine import route_content

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("", response_model=list[PolicyResponse])
def list_policies(db: Session = Depends(get_db)) -> list[PolicyResponse]:
    return PolicyRepository(db).list()


@router.put("/{slug}", response_model=PolicyResponse)
def update_policy(slug: str, update: PolicyUpdate, db: Session = Depends(get_db)) -> PolicyResponse:
    repo = PolicyRepository(db)
    policy = repo.get_by_slug(slug)
    if not policy:
        raise HTTPException(status_code=404, detail="Platform policy not found")
    return repo.update(policy, **update.model_dump())


@router.post("/preview")
def preview_routing(preview: RoutingPreview) -> dict[str, str]:
    return {
        "decision": route_content(
            preview.confidence, preview.review_threshold, preview.reject_threshold
        )
    }
