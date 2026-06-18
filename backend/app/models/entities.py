import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PlatformPolicy(Base):
    __tablename__ = "platform_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    review_threshold: Mapped[float] = mapped_column(Float)
    reject_threshold: Mapped[float] = mapped_column(Float)
    settings_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ModerationResult(Base):
    __tablename__ = "moderation_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content: Mapped[str] = mapped_column(Text)
    context: Mapped[str] = mapped_column(Text, default="")
    user_history_summary: Mapped[str] = mapped_column(Text, default="")
    conversation_thread: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    platform_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("platform_policies.id"))
    scores_json: Mapped[dict[str, float]] = mapped_column(JSONB)
    top_category: Mapped[str] = mapped_column(String(50))
    routed_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    raw_confidence: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    trigger_segment: Mapped[str] = mapped_column(Text, default="")
    reasoning: Mapped[str] = mapped_column(Text)
    decision: Mapped[str] = mapped_column(String(30), index=True)
    generated_prompt: Mapped[str] = mapped_column(Text)
    raw_model_response: Mapped[dict[str, Any]] = mapped_column(JSONB)
    policy_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    platform: Mapped[PlatformPolicy] = relationship()
    review: Mapped["ReviewQueue | None"] = relationship(back_populates="moderation_result")


class ReviewQueue(Base):
    __tablename__ = "review_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    moderation_result_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("moderation_results.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    human_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    override_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reviewer_notes: Mapped[str] = mapped_column(Text, default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    moderation_result: Mapped[ModerationResult] = relationship(back_populates="review")


class FeedbackStat(Base):
    __tablename__ = "feedback_stats"

    category: Mapped[str] = mapped_column(String(50), primary_key=True)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    overrides: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float] = mapped_column(Float, default=1.0)


class DatasetSample(Base):
    __tablename__ = "dataset_samples"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text: Mapped[str] = mapped_column(Text)
    context: Mapped[str] = mapped_column(Text, default="")
    ground_truth_category: Mapped[str] = mapped_column(String(50), index=True)
