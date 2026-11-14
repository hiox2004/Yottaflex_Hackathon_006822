from integrity.config import Settings


def test_ai_layer_is_off_by_default() -> None:
    assert Settings(_env_file=None).ai_enabled is False  # type: ignore[call-arg]


def test_database_url_can_be_overridden(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@example:5432/x")
    assert Settings(_env_file=None).database_url.endswith("@example:5432/x")  # type: ignore[call-arg]
