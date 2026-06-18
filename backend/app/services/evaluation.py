from sqlalchemy.orm import Session

from app.repositories.repositories import DatasetRepository, PolicyRepository
from app.schemas.api import CATEGORIES, EvaluationResponse
from app.services.gemini import GeminiService
from app.core.config import get_settings
from app.services.moderation import policy_snapshot


class EvaluationService:
    def __init__(self, db: Session):
        self.datasets = DatasetRepository(db)
        self.policies = PolicyRepository(db)
        self.gemini = GeminiService(get_settings())

    async def run(self, platform: str, limit: int) -> EvaluationResponse:
        policy = self.policies.get_by_slug(platform)
        if not policy:
            raise ValueError("Platform policy not found")
        samples = self.datasets.list(limit)
        matrix = {truth: {pred: 0 for pred in CATEGORIES} for truth in CATEGORIES}
        predictions = []
        snapshot = policy_snapshot(policy)
        for sample in samples:
            prompt = self.gemini.build_prompt(sample.text, sample.context, snapshot, "")
            analysis, _ = await self.gemini.analyze(
                prompt, sample.text, sample.context, snapshot
            )
            matrix[sample.ground_truth_category][analysis.top_category] += 1
            predictions.append(
                {
                    "id": str(sample.id),
                    "text": sample.text,
                    "ground_truth": sample.ground_truth_category,
                    "prediction": analysis.top_category,
                    "confidence": analysis.scores.model_dump()[analysis.top_category],
                }
            )
        total = len(predictions)
        correct = sum(matrix[c][c] for c in CATEGORIES)
        precisions, recalls = [], []
        for category in CATEGORIES:
            tp = matrix[category][category]
            predicted = sum(matrix[truth][category] for truth in CATEGORIES)
            actual = sum(matrix[category].values())
            precisions.append(tp / predicted if predicted else 0)
            recalls.append(tp / actual if actual else 0)
        return EvaluationResponse(
            accuracy=round(correct / total, 4) if total else 0,
            precision=round(sum(precisions) / len(CATEGORIES), 4),
            recall=round(sum(recalls) / len(CATEGORIES), 4),
            confusion_matrix=matrix,
            predictions=predictions,
        )
