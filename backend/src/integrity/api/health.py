from fastapi import APIRouter, HTTPException

from integrity import db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    if not db.ping():
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ok", "database": "up"}
