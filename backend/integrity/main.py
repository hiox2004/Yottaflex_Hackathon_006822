"""FastAPI application entry point. Run: uvicorn integrity.main:app --app-dir backend"""

from fastapi import FastAPI, HTTPException

from integrity import db

app = FastAPI(title="Academic Integrity Workflow", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    if not db.ping():
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ok", "database": "up"}
