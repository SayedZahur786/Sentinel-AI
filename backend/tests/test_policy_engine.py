from app.core.config import Settings
from app.schemas.api import GeminiAnalysis, PolicyUpdate
from app.services.gemini import GeminiService
from app.repositories.repositories import smoothed_accuracy
from app.services.moderation import disabled_categories_for
from app.services.policy_engine import route_content


class _Policy:
    """Lightweight stand-in for a PlatformPolicy row."""

    def __init__(self, settings_json):
        self.settings_json = settings_json


def _mock_service() -> GeminiService:
    return GeminiService(Settings(ai_mock_mode=True, gemini_api_key=""))


def test_policy_routes_at_boundaries() -> None:
    assert route_content(0.39, 0.4, 0.7) == "AUTO_APPROVE"
    assert route_content(0.4, 0.4, 0.7) == "HUMAN_REVIEW"
    assert route_content(0.7, 0.4, 0.7) == "AUTO_REJECT"


def test_analysis_repairs_incorrect_top_category() -> None:
    analysis = GeminiAnalysis.model_validate(
        {
            "scores": {
                "hate_speech": 0.1,
                "harassment": 0.2,
                "spam": 0.1,
                "misinformation": 0.1,
                "graphic_violence": 0.9,
                "adult_content": 0.1,
                "self_harm": 0.1,
            },
            "top_category": "harassment",
            "trigger_segment": "I will shoot you",
            "reasoning": "A violent threat.",
        }
    )
    assert analysis.top_category == "graphic_violence"


def test_policy_thresholds_must_be_ordered() -> None:
    try:
        PolicyUpdate(review_threshold=0.8, reject_threshold=0.7, settings_json={})
        raise AssertionError("Expected validation error")
    except ValueError:
        pass


def test_mock_is_context_aware() -> None:
    """The same statement scores high in a hostile context and low in a benign one."""
    service = _mock_service()
    content = "I'm going to destroy you."
    hostile = service._mock_analysis(content, context="private message after an argument")
    benign = service._mock_analysis(
        content,
        context="ranked match lobby",
        conversation_thread=[{"author": "p1", "text": "good game everyone, fun match"}],
    )
    assert hostile["scores"]["harassment"] > benign["scores"]["harassment"]
    assert hostile["scores"]["harassment"] >= 0.8
    assert benign["scores"]["harassment"] < 0.5


def test_intent_independent_harms_are_not_dampened() -> None:
    """Spam, misinformation, and self-harm are scored on their face regardless of context."""
    service = _mock_service()
    benign_ctx = {"context": "this is fiction in a novel"}
    assert service._mock_analysis("Click here for free money http://x.example", **benign_ctx)[
        "scores"
    ]["spam"] >= 0.8
    assert service._mock_analysis("I want to kill myself tonight", **benign_ctx)["scores"][
        "self_harm"
    ] >= 0.9


def test_disabled_categories_reads_toggles() -> None:
    policy = _Policy({"category_toggles": {"adult_content": False, "spam": True}})
    assert disabled_categories_for(policy) == ["adult_content"]


def test_calibration_is_smoothed_and_floored() -> None:
    # A single override must not zero out a category's trusted accuracy.
    assert smoothed_accuracy(1, 1) > 0.5
    # No reviews yet -> sits at the prior, not a hard 1.0 spike.
    assert 0.85 < smoothed_accuracy(0, 0) <= 1.0
    # Sustained overrides converge downward but never below the floor.
    assert smoothed_accuracy(100, 100) == 0.5
    # Sustained agreement converges toward full trust.
    assert smoothed_accuracy(100, 0) > 0.95
