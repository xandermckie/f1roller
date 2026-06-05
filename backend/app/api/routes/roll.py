from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.common import PoolInfo, RolledEntity, RollRequest
from app.services.pools import get_pool_info, roll_entity

router = APIRouter()


@router.get("/pools/{slot_id}", response_model=PoolInfo)
def pool_info(slot_id: str, db: Session = Depends(get_db)) -> PoolInfo:
    return get_pool_info(db, slot_id)


@router.post("/roll", response_model=RolledEntity)
def roll(request: RollRequest, db: Session = Depends(get_db)) -> RolledEntity:
    entity = roll_entity(db, request.slot_id, request.excluded_ids, request.session_seed)
    if not entity:
        raise HTTPException(status_code=404, detail="No entities available in pool")
    return entity
