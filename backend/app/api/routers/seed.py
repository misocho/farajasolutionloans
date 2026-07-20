from fastapi import APIRouter, Header, HTTPException
import os

from app.db.seed import seed
from app.core.config import settings


router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/seed")
def seed_database(x_seed_key: str = Header(...)):
    if x_seed_key != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

    seed()

    return {"message": "Database seeded successfully"}
