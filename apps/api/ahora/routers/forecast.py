"""Endpoints de pronostico meteorologico (GFS) y analisis on-demand."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ahora.db import get_session
from ahora.gee.precipitation import get_chirps_daily, get_gfs_forecast
from ahora.logging_setup import log
from ahora.orchestrator.pipelines import PIPELINES
from ahora.orchestrator.runner import execute, start_run

router = APIRouter(prefix="/forecast", tags=["forecast"])

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 60 * 30  # 30 min — GFS se actualiza cada 6h


@router.get("/{cuenca_id}")
async def get_forecast(cuenca_id: str) -> dict[str, Any]:
    """Pronostico GFS 48h + lluvia retrospectiva CHIRPS + umbral local."""
    now = time.time()
    cached = _CACHE.get(cuenca_id)
    if cached and (now - cached[0]) < _TTL_SECONDS:
        return cached[1]

    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT ST_X(c.centro), ST_Y(c.centro), c.nombre, c.foco, "
                "       COALESCE(t.p95_mm_24h, 20.0) "
                "FROM cuenca c "
                "LEFT JOIN rain_threshold t ON t.cuenca_id = c.id "
                "WHERE c.id = :c"
            ),
            {"c": cuenca_id},
        )
        row = res.first()
    if not row:
        raise HTTPException(404, f"cuenca '{cuenca_id}' no existe")

    lon, lat, nombre, foco, p95 = float(row[0]), float(row[1]), row[2], row[3], float(row[4])
    geom = (lon, lat, 15000)

    forecast = get_gfs_forecast(cuenca_id, geom, hours=48)
    chirps_recent = get_chirps_daily(cuenca_id, geom, days=14)

    max_24h = forecast.get("mm_24h_max") or 0
    severity_predicted = _severity(max_24h, p95)
    trigger = max_24h > p95

    payload = {
        "cuenca_id": cuenca_id,
        "cuenca_nombre": nombre,
        "cuenca_foco": foco,
        "p95_threshold_mm": round(p95, 1),
        "forecast_48h": {
            "mm_24h_mean": round(forecast.get("mm_24h_mean") or 0, 1),
            "mm_24h_max": round(max_24h, 1),
            "horizon_hours": forecast.get("horizon_hours", 48),
        },
        "severity_predicted": severity_predicted,
        "trigger_active": trigger,
        "ratio_over_threshold": round(max_24h / p95, 2) if p95 > 0 else 0,
        "chirps_recent_days": chirps_recent[-7:],  # ultimos 7 dias
        "as_of": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(now)),
    }

    _CACHE[cuenca_id] = (now, payload)
    return payload


def _severity(mm: float, p95: float) -> str:
    if p95 <= 0:
        return "low"
    ratio = mm / p95
    if ratio >= 4: return "extreme"
    if ratio >= 2: return "high"
    if ratio >= 1.2: return "medium"
    return "low"


@router.post("/{cuenca_id}/analyze-now")
async def analyze_now(cuenca_id: str) -> dict[str, Any]:
    """Corre el pipeline monitor on-demand. Si el pronostico supera el umbral,
    dispara alertas Telegram. Si no, devuelve un resumen sin alertas."""
    payload = {"cuenca_id": cuenca_id}
    run_id = await start_run("monitor", payload)
    result = await execute(PIPELINES["monitor"], run_id, payload)

    if result.get("status") != "success":
        return {"ok": False, "run_id": str(run_id), "error": result.get("error")}

    ctx = result.get("context", {})
    triggered = ctx.get("evaluate-trigger", {})
    persisted = ctx.get("persist-event", {})
    notified = ctx.get("notify-console", {}) if persisted.get("created") else {}

    return {
        "ok": True,
        "run_id": str(run_id),
        "trigger_active": triggered.get("trigger", False),
        "forecast_mm_24h_max": triggered.get("forecast_mm_24h_max"),
        "p95_threshold": triggered.get("threshold"),
        "alert_created": persisted.get("created", False),
        "severity": persisted.get("severity"),
        "telegram_channels_notified": notified.get("telegram_channels", 0),
        "telegram_results": notified.get("telegram_results", []),
    }
