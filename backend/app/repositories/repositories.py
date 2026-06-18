from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import DatasetSample, FeedbackStat, ModerationResult, PlatformPolicy, ReviewQueue

# Laplace-style smoothing for per-category calibration. A handful of reviews should
# nudge a category's trusted accuracy, not swing it to an extreme. We start from a
# strong prior (PRIOR_STRENGTH pseudo-reviews at PRIOR_ACCURACY) and never let the
# multiplier collapse confidence entirely (ACCURACY_FLOOR).
PRIOR_STRENGTH = 5.0
PRIOR_ACCURACY = 0.9
ACCURACY_FLOOR = 0.5


def smoothed_accuracy(total_reviews: int, overrides: int) -> float:
    correct = total_reviews - overrides
    estimate = (correct + PRIOR_ACCURACY * PRIOR_STRENGTH) / (total_reviews + PRIOR_STRENGTH)
    return round(max(ACCURACY_FLOOR, min(1.0, estimate)), 4)


class PolicyRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[PlatformPolicy]:
        return list(self.db.scalars(select(PlatformPolicy).order_by(PlatformPolicy.name)))

    def get_by_slug(self, slug: str) -> PlatformPolicy | None:
        return self.db.scalar(select(PlatformPolicy).where(PlatformPolicy.slug == slug))

    def update(self, policy: PlatformPolicy, **values: object) -> PlatformPolicy:
        for key, value in values.items():
            setattr(policy, key, value)
        self.db.commit()
        self.db.refresh(policy)
        return policy


class ModerationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, result: ModerationResult, needs_review: bool) -> ModerationResult:
        self.db.add(result)
        self.db.flush()
        if needs_review:
            self.db.add(ReviewQueue(moderation_result_id=result.id))
        self.db.commit()
        return self.get(result.id)

    def get(self, result_id: UUID) -> ModerationResult | None:
        return self.db.scalar(
            select(ModerationResult)
            .options(joinedload(ModerationResult.platform), joinedload(ModerationResult.review))
            .where(ModerationResult.id == result_id)
        )

    def list(self, limit: int = 100, decision: str | None = None) -> list[ModerationResult]:
        query = (
            select(ModerationResult)
            .options(joinedload(ModerationResult.platform))
            .order_by(ModerationResult.created_at.desc())
            .limit(limit)
        )
        if decision:
            query = query.where(ModerationResult.decision == decision)
        return list(self.db.scalars(query).unique())


class ReviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, status: str | None = "pending") -> list[ReviewQueue]:
        query = (
            select(ReviewQueue)
            .options(
                joinedload(ReviewQueue.moderation_result).joinedload(ModerationResult.platform)
            )
            .order_by(ReviewQueue.created_at.desc())
        )
        if status:
            query = query.where(ReviewQueue.status == status)
        return list(self.db.scalars(query).unique())

    def get(self, review_id: UUID) -> ReviewQueue | None:
        return self.db.scalar(
            select(ReviewQueue)
            .options(
                joinedload(ReviewQueue.moderation_result).joinedload(ModerationResult.platform)
            )
            .where(ReviewQueue.id == review_id)
        )

    def decide(
        self, review: ReviewQueue, decision: str, notes: str, override_category: str | None
    ) -> ReviewQueue:
        review.status = decision
        review.human_decision = decision
        review.reviewer_notes = notes
        review.override_category = override_category
        review.reviewed_at = datetime.now(timezone.utc)
        self.db.flush()

        result = review.moderation_result
        # Calibration is attributed to the category that actually drove routing.
        category = result.routed_category or result.top_category
        # A queued item was classified as sufficiently harmful to require intervention.
        # Approval therefore counts as an override; rejection confirms the classification.
        was_override = decision == "approved" or bool(
            override_category and override_category != category
        )
        stat = self.db.get(FeedbackStat, category)
        if not stat:
            stat = FeedbackStat(category=category)
            self.db.add(stat)
        stat.total_reviews += 1
        stat.overrides += int(was_override)
        stat.accuracy = smoothed_accuracy(stat.total_reviews, stat.overrides)
        self.db.commit()
        return self.get(review.id)


class FeedbackRepository:
    def __init__(self, db: Session):
        self.db = db

    def accuracy_for(self, category: str) -> float:
        stat = self.db.get(FeedbackStat, category)
        return stat.accuracy if stat else 1.0


class DatasetRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, limit: int = 100) -> list[DatasetSample]:
        return list(self.db.scalars(select(DatasetSample).limit(limit)))


class AnalyticsRepository:
    def __init__(self, db: Session):
        self.db = db

    def metrics(self) -> dict[str, float | int]:
        total = self.db.scalar(select(func.count(ModerationResult.id))) or 0
        counts = dict(
            self.db.execute(
                select(ModerationResult.decision, func.count(ModerationResult.id)).group_by(
                    ModerationResult.decision
                )
            ).all()
        )
        reviews = self.db.scalar(select(func.sum(FeedbackStat.total_reviews))) or 0
        overrides = self.db.scalar(select(func.sum(FeedbackStat.overrides))) or 0
        return {
            "total_analyses": total,
            "auto_approved": counts.get("AUTO_APPROVE", 0),
            "auto_rejected": counts.get("AUTO_REJECT", 0),
            "human_review": counts.get("HUMAN_REVIEW", 0),
            "moderator_override_rate": round(overrides / reviews, 4) if reviews else 0,
        }

    def grouped(self, column: object) -> list[tuple[object, int]]:
        return list(
            self.db.execute(
                select(column, func.count(ModerationResult.id))
                .group_by(column)
                .order_by(func.count(ModerationResult.id).desc())
            ).all()
        )
