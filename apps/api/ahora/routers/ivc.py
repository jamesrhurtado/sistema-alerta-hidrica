from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ahora.db import get_session
from ahora.gee.ivc import compute_ivc, params_hash
from ahora.models import IvcParams, IvcSummary

router = APIRouter(prefix="/ivc", tags=["ivc"])


@router.get("/{cuenca_id}", response_model=IvcSummary)
async def get_or_compute_ivc(cuenca_id: str) -> IvcSummary:
    params = IvcParams()
    phash = params_hash(params)

    # Cache: si ya hay un run ready con los mismos params, devolverlo
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT ivc_mean, ivc_max, pop_high_risk, area_urb_inund_ha, tile_url, geotiff_url, status, error "
                "FROM ivc_run WHERE cuenca_id=:c AND params_hash=:p AND status='ready' "
                "ORDER BY finished_at DESC LIMIT 1"
            ),
            {"c": cuenca_id, "p": phash},
        )
        row = res.first()

    if row:
        return IvcSummary(
            cuenca_id=cuenca_id,
            params=params,
            ivc_mean=row[0],
            ivc_max=row[1],
            pop_high_risk=row[2],
            area_urb_inund_ha=row[3],
            tile_url=row[4],
            geotiff_url=row[5],
            status="ready",
            mock=False,
        )

    # Cargar geometría de la cuenca
    async with get_session() as s:
        res = await s.execute(
            text("SELECT ST_X(centro), ST_Y(centro) FROM cuenca WHERE id=:c"),
            {"c": cuenca_id},
        )
        c = res.first()
        if not c:
            raise HTTPException(status_code=404, detail=f"cuenca '{cuenca_id}' no existe")
        lon, lat = float(c[0]), float(c[1])

    result = compute_ivc(cuenca_id, (lon, lat, 15000), params)

    async with get_session() as s:
        await s.execute(
            text(
                "INSERT INTO ivc_run (cuenca_id, params_hash, params, ivc_mean, ivc_max, "
                " pop_high_risk, area_urb_inund_ha, tile_url, geotiff_url, status, finished_at) "
                "VALUES (:c, :ph, CAST(:p AS JSONB), :m, :mx, :pop, :area, :tile, :gt, 'ready', now()) "
                "ON CONFLICT (cuenca_id, params_hash) DO UPDATE SET "
                "  ivc_mean=EXCLUDED.ivc_mean, ivc_max=EXCLUDED.ivc_max, "
                "  pop_high_risk=EXCLUDED.pop_high_risk, "
                "  area_urb_inund_ha=EXCLUDED.area_urb_inund_ha, "
                "  tile_url=EXCLUDED.tile_url, geotiff_url=EXCLUDED.geotiff_url, "
                "  status='ready', finished_at=now()"
            ),
            {
                "c": cuenca_id,
                "ph": phash,
                "p": json.dumps(params.model_dump()),
                "m": result["ivc_mean"],
                "mx": result["ivc_max"],
                "pop": result["pop_high_risk"],
                "area": result.get("area_urb_inund_ha"),
                "tile": result.get("tile_url"),
                "gt": result.get("geotiff_url"),
            },
        )
        await s.commit()

    return IvcSummary(
        cuenca_id=cuenca_id,
        params=params,
        ivc_mean=result["ivc_mean"],
        ivc_max=result["ivc_max"],
        pop_high_risk=result["pop_high_risk"],
        area_urb_inund_ha=result.get("area_urb_inund_ha"),
        tile_url=result.get("tile_url"),
        geotiff_url=result.get("geotiff_url"),
        status="ready",
        mock=result.get("mock", False),
    )
