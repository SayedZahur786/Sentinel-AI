import json
import re
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.api import CATEGORIES, GeminiAnalysis

# Plain-language definition of every harm category, embedded in the prompt so the
# model classifies against a stable, auditable rubric rather than its own priors.
CATEGORY_DEFINITIONS: dict[str, str] = {
    "hate_speech": "attacks or demeans a person or group based on protected identity "
    "(race, religion, ethnicity, gender, sexual orientation, disability)",
    "harassment": "targeted bullying, threats, intimidation, or sustained abuse aimed at an individual",
    "spam": "unsolicited bulk promotion, scams, phishing, repetitive advertising, or deceptive links",
    "misinformation": "verifiably false or misleading factual claims, especially about health, "
    "elections, or public safety",
    "graphic_violence": "graphic depictions or credible promotion of real-world violence, gore, or harm",
    "adult_content": "sexually explicit or pornographic material",
    "self_harm": "content encouraging, instructing, or expressing intent toward suicide or self-injury",
}


class GeminiService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def build_prompt(
        self,
        content: str,
        context: str,
        policy: dict[str, Any],
        user_history_summary: str,
        conversation_thread: list[dict[str, Any]] | None = None,
    ) -> str:
        schema = {
            "scores": {category: 0.0 for category in CATEGORIES},
            "top_category": CATEGORIES[0],
            "trigger_segment": "exact substring from content, or empty string",
            "reasoning": "brief, plain-language classification explanation",
        }
        definitions = "\n".join(
            f"- {category}: {description}" for category, description in CATEGORY_DEFINITIONS.items()
        )
        settings_json = policy.get("settings_json", {})
        custom_rules = settings_json.get("custom_rules", [])
        custom_rules_text = (
            "\n".join(f"- {rule}" for rule in custom_rules)
            if custom_rules
            else "No additional platform-specific rules."
        )
        thread_text = self._format_thread(conversation_thread)
        return f"""You are a content classification component in a trust & safety pipeline.
You do NOT make enforcement decisions and you do NOT pick an action. Deterministic backend
code applies the platform policy to your scores. Your only job is honest, calibrated scoring.

Context is decisive. The SAME sentence can be harmful or harmless depending on where it appears:
- "I'm going to destroy you" is harassment in a hostile DM, but harmless trash talk in a game match.
- A graphic description is violative on a kids feed but may be acceptable news reporting or fiction.
- A statement quoting or condemning hate speech is not itself hate speech.
Weigh the platform, the conversation thread, and the user's history before scoring.

Score EVERY category from 0.0 (clearly absent) to 1.0 (clearly present):
{definitions}

Platform policy:
{json.dumps({k: v for k, v in policy.items() if k != "settings_json"}, ensure_ascii=True)}

Platform-specific custom rules (treat as authoritative for this platform):
{custom_rules_text}

Conversation thread (older to newer; the content below is the latest message):
{thread_text}

Additional context:
{context or "No additional context provided."}

User history summary:
{user_history_summary or "No history available."}

Content to classify:
{content}

Return JSON only. Use exactly this shape and exactly these category keys:
{json.dumps(schema)}
The trigger_segment must be copied verbatim from Content and be the shortest useful span. If no
category applies, return low scores for all and an empty trigger_segment."""

    @staticmethod
    def _format_thread(conversation_thread: list[dict[str, Any]] | None) -> str:
        if not conversation_thread:
            return "No prior messages in this thread."
        lines = []
        for message in conversation_thread:
            author = message.get("author") or "user"
            text = message.get("text", "")
            lines.append(f"{author}: {text}")
        return "\n".join(lines)

    async def analyze(
        self,
        prompt: str,
        content: str,
        context: str = "",
        policy: dict[str, Any] | None = None,
        conversation_thread: list[dict[str, Any]] | None = None,
    ) -> tuple[GeminiAnalysis, dict[str, Any]]:
        if self.settings.ai_mock_mode or not self.settings.gemini_api_key:
            payload = self._mock_analysis(content, context, policy, conversation_thread)
            return GeminiAnalysis.model_validate(payload), {"mock": True, "parsed": payload}

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent"
        )
        request = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                url, params={"key": self.settings.gemini_api_key}, json=request
            )
            response.raise_for_status()
            raw = response.json()
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        analysis = GeminiAnalysis.model_validate(parsed)
        return analysis, {"provider_response": raw, "parsed": analysis.model_dump()}

    def _mock_analysis(
        self,
        content: str,
        context: str = "",
        policy: dict[str, Any] | None = None,
        conversation_thread: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Deterministic, context-aware stand-in for Gemini.

        It produces the same kind of context-sensitivity the real model does, so the
        product can be demonstrated and graded without a paid API key: identical content
        is scored differently depending on the conversation thread, platform, and intent
        signals around it.
        """
        lowered = content.lower()
        # (regex, base_score, dampened_by_benign_context) per category.
        patterns: dict[str, tuple[str, float, bool]] = {
            "self_harm": (
                r"\b(kill(ing)? myself|end(ing)? my life|suicide|cut(ting)? myself|want to die|self[- ]?harm)\b",
                0.93,
                False,
            ),
            "hate_speech": (
                r"\b(inferior|subhuman|vermin|should not exist|go back to)\b|\b(hate|despise)\b.*\b(race|religion|gender|muslims|jews|christians|immigrants|gay|trans)\b",
                0.9,
                True,
            ),
            "graphic_violence": (
                r"\b(kill|murder|stab|shoot|behead|slaughter|massacre|bomb|blood|gore)\w*",
                0.86,
                True,
            ),
            "harassment": (
                r"\b(i will|i'll|gonna|going to)\s+(find|get|destroy|ruin|hurt|end)\s+you\b|\b(you are|you're)\s+(pathetic|worthless|a loser|disgusting|trash)\b|\b(shut up|nobody likes you|kill yourself)\b",
                0.82,
                True,
            ),
            "adult_content": (
                r"\b(porn|nude|nudes|xxx|explicit sex|sexual|onlyfans)\b",
                0.8,
                True,
            ),
            "spam": (
                r"(https?://|www\.)\S+|\b(buy now|free money|click here|limited offer|crypto giveaway|earn \$|work from home|dm me to)\b",
                0.8,
                False,
            ),
            "misinformation": (
                r"\b(vaccines cause|the earth is flat|election was stolen|5g causes|miracle cure|drink bleach|covid is a hoax)\b",
                0.84,
                False,
            ),
        }

        scores = {category: 0.02 for category in CATEGORIES}
        trigger = ""
        top_category = CATEGORIES[0]
        best = 0.0
        benign = self._benign_context(context, policy, conversation_thread)

        for category, (pattern, base, dampenable) in patterns.items():
            match = re.search(pattern, lowered)
            if not match:
                continue
            score = base
            # Benign intent (fiction, gaming, quoting, education, news) downgrades
            # context-dependent harms but never the intent-independent ones
            # (self-harm, spam, misinformation are scored on their face).
            if dampenable and benign:
                score = round(score * 0.35, 4)
            scores[category] = max(scores[category], score)
            if scores[category] > best:
                best = scores[category]
                top_category = category
                trigger = content[match.start() : match.end()]

        reasoning = self._mock_reasoning(top_category, best, trigger, benign)
        return {
            "scores": scores,
            "top_category": top_category,
            "trigger_segment": trigger if best >= 0.4 else "",
            "reasoning": reasoning,
        }

    @staticmethod
    def _benign_context(
        context: str,
        policy: dict[str, Any] | None,
        conversation_thread: list[dict[str, Any]] | None,
    ) -> bool:
        haystack = (context or "").lower()
        if conversation_thread:
            haystack += " " + " ".join(
                (message.get("text", "") or "").lower() for message in conversation_thread
            )
        signals = (
            "game",
            "gaming",
            "match",
            "fiction",
            "novel",
            "movie",
            "fantasy",
            "quote",
            "quoted",
            "educational",
            "education",
            "news",
            "reporting",
            "historical",
            "joke",
            "satire",
        )
        contextual = any(signal in haystack for signal in signals)
        allow_violence = bool((policy or {}).get("settings_json", {}).get("allow_violence_context"))
        return contextual or allow_violence

    @staticmethod
    def _mock_reasoning(category: str, score: float, trigger: str, benign: bool) -> str:
        if score < 0.4:
            return "No clear policy-violating content was detected in this context."
        label = category.replace("_", " ")
        if benign:
            return (
                f"Surface language resembles {label}, but the surrounding context "
                f"(fictional, quoted, gaming, or reported) substantially lowers the likelihood "
                f"of a real violation."
            )
        return f"Detected language consistent with {label} based on the segment \"{trigger}\"."
