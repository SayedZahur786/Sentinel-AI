from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.repositories import DatasetRepository
from app.schemas.api import DatasetSampleResponse, EvaluationRequest, EvaluationResponse
from app.services.evaluation import EvaluationService

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("/samples", response_model=list[DatasetSampleResponse])
def samples(
    limit: int = Query(100, ge=1, le=100), db: Session = Depends(get_db)
) -> list[DatasetSampleResponse]:
    return DatasetRepository(db).list(limit)


@router.post("/run", response_model=EvaluationResponse)
async def run_evaluation(
    request: EvaluationRequest, db: Session = Depends(get_db)
) -> EvaluationResponse:
    try:
        return await EvaluationService(db).run(request.platform, request.limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
