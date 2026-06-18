from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ModerationResult
from app.repositories.repositories import (
    FeedbackRepository,
    ModerationRepository,
    PolicyRepository,
)
from app.schemas.api import CATEGORIES, ModerationRequest, ModerationResponse
from app.services.gemini import GeminiService
from app.services.policy_engine import route_content


def policy_snapshot(policy: Any) -> dict[str, Any]:
    return {
        "id": str(policy.id),
        "slug": policy.slug,
        "name": policy.name,
        "review_threshold": policy.review_threshold,
        "reject_threshold": policy.reject_threshold,
        "settings_json": policy.settings_json,
    }


def disabled_categories_for(policy: Any) -> list[str]:
    """Categories a platform has switched off entirely (never moderated)."""
    toggles = policy.settings_json.get("category_toggles", {})
    return [category for category in CATEGORIES if toggles.get(category, True) is False]


def serialize_result(result: ModerationResult) -> ModerationResponse:
    return ModerationResponse(
        id=result.id,
        content=result.content,
        context=result.context,
        platform=result.platform.slug,
        conversation_thread=result.conversation_thread or [],
        scores=result.scores_json,
        top_category=result.top_category,
        raw_confidence=result.raw_confidence,
        confidence=result.confidence,
        trigger_segment=result.trigger_segment,
        reasoning=result.reasoning,
        decision=result.decision,
        routed_category=result.routed_category,
        disabled_categories=result.policy_snapshot.get("disabled_categories", []),
        generated_prompt=result.generated_prompt,
        raw_model_response=result.raw_model_response,
        policy_snapshot=result.policy_snapshot,
        created_at=result.created_at,
    )


class ModerationService:
    def __init__(self, db: Session):
        self.db = db
        self.policies = PolicyRepository(db)
        self.results = ModerationRepository(db)
        self.feedback = FeedbackRepository(db)
        self.gemini = GeminiService(get_settings())

    async def moderate(self, request: ModerationRequest) -> ModerationResponse:
        policy = self.policies.get_by_slug(request.platform)
        if not policy:
            raise HTTPException(status_code=404, detail="Platform policy not found")

        snapshot = policy_snapshot(policy)
        thread = [message.model_dump() for message in request.conversation_thread]
        prompt = self.gemini.build_prompt(
            request.content,
            request.context,
            snapshot,
            request.user_history_summary,
            thread,
        )
        analysis, raw_response = await self.gemini.analyze(
            prompt, request.content, request.context, snapshot, thread
        )
        if (
            analysis.trigger_segment
            and analysis.trigger_segment.lower() not in request.content.lower()
        ):
            analysis.trigger_segment = ""
        scores = analysis.scores.model_dump()

        # The model classifies all categories, but the platform only enforces the ones it
        # has enabled. Routing is driven by the highest-scoring *enabled* category.
        disabled = disabled_categories_for(policy)
        enabled_scores = {c: s for c, s in scores.items() if c not in disabled}
        routed_category = max(enabled_scores, key=enabled_scores.get) if enabled_scores else None
        raw_confidence = enabled_scores.get(routed_category, 0.0) if routed_category else 0.0

        accuracy = self.feedback.accuracy_for(routed_category) if routed_category else 1.0
        confidence = round(max(0.0, min(1.0, raw_confidence * accuracy)), 4)

        multipliers = policy.settings_json.get("category_threshold_multipliers", {})
        multiplier = float(multipliers.get(routed_category, 1.0)) if routed_category else 1.0
        effective_confidence = min(1.0, confidence * multiplier)
        decision = route_content(
            effective_confidence, policy.review_threshold, policy.reject_threshold
        )
        result = ModerationResult(
            content=request.content,
            context=request.context,
            user_history_summary=request.user_history_summary,
            conversation_thread=thread,
            platform_id=policy.id,
            scores_json=scores,
            top_category=analysis.top_category,
            routed_category=routed_category,
            raw_confidence=raw_confidence,
            confidence=confidence,
            trigger_segment=analysis.trigger_segment,
            reasoning=analysis.reasoning,
            decision=decision,
            generated_prompt=prompt,
            raw_model_response=raw_response,
            policy_snapshot={
                **snapshot,
                "calibration_accuracy": accuracy,
                "multiplier": multiplier,
                "disabled_categories": disabled,
                "effective_confidence": round(effective_confidence, 4),
            },
        )
        return serialize_result(self.results.create(result, decision == "HUMAN_REVIEW"))
