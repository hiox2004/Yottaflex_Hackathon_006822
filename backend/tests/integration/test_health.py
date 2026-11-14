from fastapi.testclient import TestClient

from integrity.main import app


def test_health_reports_database_up() -> None:
    r = TestClient(app).get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "up"}
