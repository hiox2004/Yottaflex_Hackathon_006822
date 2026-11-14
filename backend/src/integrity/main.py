"""Application entry point. Run from backend/: uvicorn integrity.main:app --reload"""

from fastapi import FastAPI

from integrity.api import health

app = FastAPI(title="Academic Integrity Workflow", version="0.1.0")
app.include_router(health.router)
