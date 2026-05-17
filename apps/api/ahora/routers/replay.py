from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ahora.models import ReplayRequest
from ahora.orchestrator.pipelines import PIPELINES, REPLAY_EVENTS
from ahora.orchestrator.runner import execute, start_run

router = APIRouter(prefix="/replay", tags=["replay"])


@router.get("/events")
async def list_events() -> list[dict[str, Any]]:
    return [{"id": k, **v} for k, v in REPLAY_EVENTS.items()]


@router.post("")
async def trigger_replay(req: ReplayRequest) -> dict[str, object]:
    payload = req.model_dump()
    run_id = await start_run("replay", payload)
    result = await execute(PIPELINES["replay"], run_id, payload)
    return result


@router.post("/monitor")
async def trigger_monitor(cuenca_id: str = "rimac") -> dict[str, object]:
    """Dispara el pipeline diario para una cuenca (manual)."""
    payload = {"cuenca_id": cuenca_id}
    run_id = await start_run("monitor", payload)
    result = await execute(PIPELINES["monitor"], run_id, payload)
    return result
