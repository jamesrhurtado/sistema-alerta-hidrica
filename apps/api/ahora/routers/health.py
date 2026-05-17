from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from ahora.config import settings
from ahora.db import get_session
from ahora.gee.auth import init_gee, is_mock

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, object]:
    db_ok = False
    db_err: str | None = None
    try:
        async with get_session() as s:
            await s.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:  # noqa: BLE001
        db_err = f"{type(exc).__name__}: {exc}"

    gee_ready = init_gee()

    return {
        "status": "ok" if db_ok else "degraded",
        "db": {"ok": db_ok, "error": db_err},
        "gee": {
            "ready": gee_ready,
            "mock_mode": is_mock(),
        },
        "storage_dir": str(settings.local_storage_dir.resolve()),
    }
