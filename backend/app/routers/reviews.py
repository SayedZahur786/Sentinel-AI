from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.repositories import ReviewRepository
from app.schemas.api import ReviewAction, ReviewResponse
from app.services.moderation import serialize_result

router = APIRouter(prefix="/reviews", tags=["reviews"])


def serialize_review(review: object) -> ReviewResponse:
    return ReviewResponse(
        id=review.id,
        status=review.status,
        human_decision=review.human_decision,
        override_category=review.override_category,
        reviewer_notes=review.reviewer_notes,
        reviewed_at=review.reviewed_at,
        moderation=serialize_result(review.moderation_result),
    )


@router.get("", response_model=list[ReviewResponse])
def list_reviews(
    status: str | None = "pending", db: Session = Depends(get_db)
) -> list[ReviewResponse]:
    return [serialize_review(item) for item in ReviewRepository(db).list(status)]


@router.post("/{review_id}/decision", response_model=ReviewResponse)
def decide_review(
    review_id: UUID, action: ReviewAction, db: Session = Depends(get_db)
) -> ReviewResponse:
    repo = ReviewRepository(db)
    review = repo.get(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review item not found")
    if review.status != "pending":
        raise HTTPException(status_code=409, detail="Review item has already been decided")
    return serialize_review(
        repo.decide(review, action.decision, action.reviewer_notes, action.override_category)
    )
