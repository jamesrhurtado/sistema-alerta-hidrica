"""Endpoint de capas geoespaciales para MapLibre."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ahora.db import get_session
from ahora.gee.layers import build_layer_stack, stack_hash
from ahora.logging_setup import log
from ahora.models import IvcParams

router = APIRouter(prefix="/layers", tags=["layers"])

# Cache en proceso: {hash: (timestamp, payload)}
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 60 * 30  # 30 min — tile URLs siguen siendo válidas mucho más


@router.get("/{cuenca_id}")
async def get_layers(cuenca_id: str) -> dict[str, Any]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT ST_X(centro) AS lon, ST_Y(centro) AS lat, zoom, nombre, foco "
                "FROM cuenca WHERE id=:c"
            ),
            {"c": cuenca_id},
        )
        row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail=f"cuenca '{cuenca_id}' no existe")

    params = IvcParams()
    cache_key = stack_hash(cuenca_id, params)
    now = time.time()

    cached = _CACHE.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        log.info("layers.cache_hit", cuenca=cuenca_id)
        return cached[1]

    stack = build_layer_stack(
        cuenca_id,
        (float(row[0]), float(row[1]), 15000),
        params,
    )

    payload = {
        "cuenca_id": cuenca_id,
        "cuenca_nombre": row[3],
        "cuenca_foco": row[4],
        "center": [float(row[0]), float(row[1])],
        "zoom": int(row[2]),
        "params": params.model_dump(),
        "layers": stack["layers"],
        "stats": stack["stats"],
        "year_urb_start": stack["year_urb_start"],
        "year_urb_end": stack["year_urb_end"],
        "total_years": stack["total_years"],
        "mock": stack.get("mock", False),
    }

    _CACHE[cache_key] = (now, payload)
    return payload


@router.delete("/{cuenca_id}/cache")
async def invalidate_cache(cuenca_id: str) -> dict[str, Any]:
    """Forza recálculo en la siguiente llamada."""
    params = IvcParams()
    key = stack_hash(cuenca_id, params)
    removed = _CACHE.pop(key, None) is not None
    return {"cuenca_id": cuenca_id, "evicted": removed}
