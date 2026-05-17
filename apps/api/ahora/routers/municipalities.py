"""Endpoints de municipalidades — el modelo multi-tenant del sistema."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ahora.db import get_session

router = APIRouter(prefix="/municipalities", tags=["municipalities"])


@router.get("")
async def list_municipalities() -> list[dict[str, Any]]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT m.id, m.nombre, m.parent_id, m.nivel, m.domain_hint, "
                "       m.whatsapp_kapso_url, m.teams_webhook_url, "
                "       COUNT(mc.cuenca_id) AS n_cuencas "
                "FROM municipality m "
                "LEFT JOIN municipality_cuenca mc ON mc.municipality_id = m.id "
                "GROUP BY m.id "
                "ORDER BY m.nivel, m.nombre"
            )
        )
        return [
            {
                "id": r[0],
                "nombre": r[1],
                "parent_id": r[2],
                "nivel": r[3],
                "domain_hint": r[4],
                "whatsapp_kapso_url": r[5],
                "teams_webhook_url": r[6],
                "n_cuencas": int(r[7]),
            }
            for r in res.fetchall()
        ]


@router.get("/{municipality_id}")
async def get_municipality(municipality_id: str) -> dict[str, Any]:
    async with get_session() as s:
        m = await s.execute(
            text(
                "SELECT id, nombre, parent_id, nivel, domain_hint, "
                "       whatsapp_kapso_url, teams_webhook_url, "
                "       telegram_chat_id, telegram_username "
                "FROM municipality WHERE id=:id"
            ),
            {"id": municipality_id},
        )
        mrow = m.first()
        if not mrow:
            raise HTTPException(status_code=404, detail=f"municipalidad '{municipality_id}' no existe")

        c = await s.execute(
            text(
                "SELECT c.id, c.nombre, c.foco, ST_X(c.centro) AS lon, ST_Y(c.centro) AS lat, c.zoom "
                "FROM cuenca c "
                "JOIN municipality_cuenca mc ON mc.cuenca_id = c.id "
                "WHERE mc.municipality_id = :m "
                "ORDER BY c.nombre"
            ),
            {"m": municipality_id},
        )
        cuencas = [
            {
                "id": r[0],
                "nombre": r[1],
                "foco": r[2],
                "lon": float(r[3]),
                "lat": float(r[4]),
                "zoom": int(r[5]),
            }
            for r in c.fetchall()
        ]

        # Conteo de suscriptores activos por canal
        subs = await s.execute(
            text(
                "SELECT canal, COUNT(*) FROM subscriber "
                "WHERE municipality_id = :m AND activo = true "
                "GROUP BY canal"
            ),
            {"m": municipality_id},
        )
        canales = {row[0]: int(row[1]) for row in subs.fetchall()}

    return {
        "id": mrow[0],
        "nombre": mrow[1],
        "parent_id": mrow[2],
        "nivel": mrow[3],
        "domain_hint": mrow[4],
        "whatsapp_kapso_url": mrow[5],
        "teams_webhook_url": mrow[6],
        "telegram_chat_id": mrow[7],
        "telegram_username": mrow[8],
        "cuencas": cuencas,
        "suscriptores_por_canal": canales,
    }
