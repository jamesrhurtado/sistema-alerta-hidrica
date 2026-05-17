"""Scheduler de monitoreo automatico.

Cada N minutos (configurable via MONITOR_INTERVAL_MINUTES), revisa todas las
cuencas activas y dispara el pipeline de monitor. Solo genera alertas si el
pronostico GFS supera el umbral p95 local — en condiciones normales no hace
nada visible.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text

from ahora.config import settings
from ahora.db import get_session
from ahora.logging_setup import log
from ahora.orchestrator.pipelines import PIPELINES
from ahora.orchestrator.runner import execute, start_run

_LAST_SCAN: dict[str, Any] = {
    "ran_at": None,
    "next_at": None,
    "cuencas_scanned": 0,
    "alerts_triggered": 0,
}


def get_scheduler_status() -> dict[str, Any]:
    return {
        "interval_minutes": settings.monitor_interval_minutes,
        "enabled": settings.monitor_interval_minutes > 0,
        **_LAST_SCAN,
    }


async def monitor_loop() -> None:
    """Loop infinito: corre cada N minutos."""
    interval = settings.monitor_interval_minutes * 60
    # Espera inicial corta para que la app termine de iniciar
    await asyncio.sleep(10)

    while True:
        try:
            await _scan_once()
        except asyncio.CancelledError:
            log.info("scheduler.cancelled")
            return
        except Exception as exc:  # noqa: BLE001
            log.error("scheduler.scan_failed", error=str(exc))

        _LAST_SCAN["next_at"] = datetime.now(UTC).isoformat()
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            return


async def _scan_once() -> None:
    started = datetime.now(UTC)
    async with get_session() as s:
        res = await s.execute(text("SELECT id FROM cuenca ORDER BY id"))
        cuencas = [r[0] for r in res.fetchall()]

    alerts_count = 0
    for c_id in cuencas:
        try:
            payload = {"cuenca_id": c_id}
            run_id = await start_run("monitor", payload)
            result = await execute(PIPELINES["monitor"], run_id, payload)
            if result["status"] == "success":
                ctx = result.get("context", {})
                if ctx.get("persist-event", {}).get("created"):
                    alerts_count += 1
        except Exception as exc:  # noqa: BLE001
            log.warning("scheduler.cuenca_failed", cuenca=c_id, error=str(exc))

    _LAST_SCAN.update({
        "ran_at": started.isoformat(),
        "cuencas_scanned": len(cuencas),
        "alerts_triggered": alerts_count,
    })
    log.info(
        "scheduler.scan_done",
        cuencas=len(cuencas), alerts=alerts_count,
        elapsed=(datetime.now(UTC) - started).total_seconds(),
    )
