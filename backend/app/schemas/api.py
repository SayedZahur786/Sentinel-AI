from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Canonical harm taxonomy for the moderation pipeline. The model only classifies;
# the deterministic policy engine decides the enforcement action.
CATEGORIES = (
    "hate_speech",
    "harassment",
    "spam",
    "misinformation",
    "graphic_violence",
    "adult_content",
    "self_harm",
)
Category = Literal[
    "hate_speech",
    "harassment",
    "spam",
    "misinformation",
    "graphic_violence",
    "adult_content",
    "self_harm",
]
Decision = Literal["AUTO_APPROVE", "HUMAN_REVIEW", "AUTO_REJECT"]


class CategoryScores(BaseModel):
    hate_speech: float = Field(ge=0, le=1)
    harassment: float = Field(ge=0, le=1)
    spam: float = Field(ge=0, le=1)
    misinformation: float = Field(ge=0, le=1)
    graphic_violence: float = Field(ge=0, le=1)
    adult_content: float = Field(ge=0, le=1)
    self_harm: float = Field(ge=0, le=1)


class GeminiAnalysis(BaseModel):
    scores: CategoryScores
    top_category: Category
    trigger_segment: str = Field(max_length=500)
    reasoning: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def ensure_top_category_matches_scores(self) -> "GeminiAnalysis":
        values = self.scores.model_dump()
        actual = max(values, key=values.get)
        if self.top_category != actual:
            self.top_category = actual
        return self


class ThreadMessage(BaseModel):
    author: str = Field(default="user", max_length=120)
    text: str = Field(min_length=1, max_length=4000)


class ModerationRequest(BaseModel):
    content: str = Field(min_length=1, max_length=20000)
    context: str = Field(default="", max_length=10000)
    platform: str
    user_history_summary: str = Field(default="", max_length=5000)
    conversation_thread: list[ThreadMessage] = Field(default_factory=list, max_length=50)


class ModerationResponse(BaseModel):
    id: UUID
    content: str
    context: str
    platform: str
    conversation_thread: list[ThreadMessage]
    scores: dict[str, float]
    top_category: str
    raw_confidence: float
    confidence: float
    trigger_segment: str
    reasoning: str
    decision: Decision
    routed_category: str | None
    disabled_categories: list[str]
    generated_prompt: str
    raw_model_response: dict[str, Any]
    policy_snapshot: dict[str, Any]
    created_at: datetime


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    review_threshold: float
    reject_threshold: float
    settings_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class PolicyUpdate(BaseModel):
    review_threshold: float = Field(ge=0, le=1)
    reject_threshold: float = Field(ge=0, le=1)
    settings_json: dict[str, Any]

    @model_validator(mode="after")
    def thresholds_are_ordered(self) -> "PolicyUpdate":
        if self.review_threshold >= self.reject_threshold:
            raise ValueError("review_threshold must be below reject_threshold")
        return self


class RoutingPreview(BaseModel):
    confidence: float = Field(ge=0, le=1)
    review_threshold: float = Field(ge=0, le=1)
    reject_threshold: float = Field(ge=0, le=1)


class ReviewAction(BaseModel):
    decision: Literal["approved", "rejected"]
    reviewer_notes: str = Field(default="", max_length=5000)
    override_category: Category | None = None


class ReviewResponse(BaseModel):
    id: UUID
    status: str
    human_decision: str | None
    override_category: str | None
    reviewer_notes: str
    reviewed_at: datetime | None
    moderation: ModerationResponse


class DashboardResponse(BaseModel):
    metrics: dict[str, float | int]
    category_distribution: list[dict[str, Any]]
    platform_distribution: list[dict[str, Any]]
    confidence_distribution: list[dict[str, Any]]
    recent_activity: list[ModerationResponse]


class DatasetSampleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    context: str
    ground_truth_category: str


class EvaluationRequest(BaseModel):
    platform: str = "social"
    limit: int = Field(default=20, ge=1, le=100)


class EvaluationResponse(BaseModel):
    accuracy: float
    precision: float
    recall: float
    confusion_matrix: dict[str, dict[str, int]]
    predictions: list[dict[str, Any]]
