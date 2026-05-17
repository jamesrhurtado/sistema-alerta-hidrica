"""Análisis retrospectivo de eventos históricos (Sentinel-1 + GHSL)."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ahora.db import get_session
from ahora.gee.sentinel1 import EVENT_WINDOWS, analyze_historical_event
from ahora.logging_setup import log

router = APIRouter(prefix="/analysis", tags=["analysis"])

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL = 60 * 30


@router.get("/events")
async def list_events() -> list[dict[str, Any]]:
    return [
        {"id": k, **v}
        for k, v in EVENT_WINDOWS.items()
    ]


@router.get("/events/{event_id}")
async def get_event_analysis(event_id: str) -> dict[str, Any]:
    if event_id not in EVENT_WINDOWS:
        raise HTTPException(status_code=404, detail=f"evento '{event_id}' no existe")

    now = time.time()
    cached = _CACHE.get(event_id)
    if cached and (now - cached[0]) < _TTL:
        log.info("analysis.cache_hit", event_key=event_id)
        return cached[1]

    cuenca_id = EVENT_WINDOWS[event_id]["cuenca_id"]
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT ST_X(centro), ST_Y(centro), nombre, foco, zoom "
                "FROM cuenca WHERE id=:c"
            ),
            {"c": cuenca_id},
        )
        row = res.first()
    if not row:
        raise HTTPException(status_code=500, detail=f"cuenca '{cuenca_id}' no configurada")

    analysis = analyze_historical_event(
        event_id, (float(row[0]), float(row[1]), 15000)
    )
    analysis.update({
        "cuenca_nombre": row[2],
        "cuenca_foco": row[3],
        "center": [float(row[0]), float(row[1])],
        "zoom": int(row[4]),
    })

    _CACHE[event_id] = (now, analysis)
    return analysis
