from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ahora.db import get_session

router = APIRouter(prefix="/cuencas", tags=["cuencas"])


@router.get("")
async def list_cuencas() -> list[dict[str, object]]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT id, nombre, foco, ST_X(centro) AS lon, ST_Y(centro) AS lat, zoom "
                "FROM cuenca ORDER BY id"
            )
        )
        return [
            {
                "id": row[0],
                "nombre": row[1],
                "foco": row[2],
                "lon": float(row[3]),
                "lat": float(row[4]),
                "zoom": int(row[5]),
            }
            for row in res.fetchall()
        ]


@router.get("/{cuenca_id}")
async def get_cuenca(cuenca_id: str) -> dict[str, object]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT id, nombre, foco, ST_X(centro) AS lon, ST_Y(centro) AS lat, zoom, "
                "       ST_AsGeoJSON(geom_aoi) AS aoi "
                "FROM cuenca WHERE id=:id"
            ),
            {"id": cuenca_id},
        )
        row = res.first()
        if not row:
            raise HTTPException(status_code=404, detail=f"cuenca '{cuenca_id}' no existe")
        return {
            "id": row[0],
            "nombre": row[1],
            "foco": row[2],
            "lon": float(row[3]),
            "lat": float(row[4]),
            "zoom": int(row[5]),
            "aoi_geojson": row[6],
        }


@router.get("/{cuenca_id}/case-studies")
async def list_case_studies(cuenca_id: str) -> list[dict[str, object]]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT id, nombre, lon, lat, zoom, descripcion "
                "FROM case_study WHERE cuenca_id=:c ORDER BY nombre"
            ),
            {"c": cuenca_id},
        )
        return [
            {
                "id": r[0],
                "nombre": r[1],
                "lon": float(r[2]),
                "lat": float(r[3]),
                "zoom": int(r[4]),
                "descripcion": r[5],
            }
            for r in res.fetchall()
        ]
