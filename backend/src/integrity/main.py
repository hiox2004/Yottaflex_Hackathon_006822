"""Application entry point. Run from backend/: uvicorn integrity.main:app --reload"""

from integrity.api.app import create_app

app = create_app()
