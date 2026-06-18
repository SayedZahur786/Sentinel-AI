from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.repositories import ModerationRepository
from app.schemas.api import ModerationRequest, ModerationResponse
from app.services.moderation import ModerationService, serialize_result

router = APIRouter(prefix="/moderations", tags=["moderations"])


@router.post("", response_model=ModerationResponse, status_code=201)
async def create_moderation(
    request: ModerationRequest, db: Session = Depends(get_db)
) -> ModerationResponse:
    return await ModerationService(db).moderate(request)


@router.get("", response_model=list[ModerationResponse])
def list_moderations(
    limit: int = Query(100, ge=1, le=500),
    decision: str | None = None,
    db: Session = Depends(get_db),
) -> list[ModerationResponse]:
    return [serialize_result(item) for item in ModerationRepository(db).list(limit, decision)]


@router.get("/{result_id}", response_model=ModerationResponse)
def get_moderation(result_id: UUID, db: Session = Depends(get_db)) -> ModerationResponse:
    result = ModerationRepository(db).get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Moderation result not found")
    return serialize_result(result)
