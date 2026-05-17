"""Endpoints de configuración por municipalidad."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from ahora.config import settings
from ahora.db import get_session
from ahora.notify.kapso import kapso

router = APIRouter(prefix="/config", tags=["config"])


class KapsoConfig(BaseModel):
    whatsapp_kapso_url: str | None = None
    teams_webhook_url: str | None = None


@router.patch("/municipality/{municipality_id}")
async def update_municipality_config(
    municipality_id: str, body: KapsoConfig
) -> dict[str, Any]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "UPDATE municipality SET "
                "  whatsapp_kapso_url = COALESCE(:wa, whatsapp_kapso_url), "
                "  teams_webhook_url = COALESCE(:tw, teams_webhook_url) "
                "WHERE id = :id "
                "RETURNING whatsapp_kapso_url, teams_webhook_url"
            ),
            {
                "id": municipality_id,
                "wa": body.whatsapp_kapso_url,
                "tw": body.teams_webhook_url,
            },
        )
        row = res.first()
        if not row:
            raise HTTPException(404, f"municipalidad '{municipality_id}' no existe")
        await s.commit()

    return {
        "municipality_id": municipality_id,
        "whatsapp_kapso_url": row[0],
        "teams_webhook_url": row[1],
    }


@router.post("/test-alert/{municipality_id}")
async def fire_test_alert(municipality_id: str) -> dict[str, Any]:
    """Dispara una alerta de prueba para una municipalidad.

    No usa pronostico real — fuerza una alerta EXTREMA para que veas el flujo
    completo de notificaciones (WhatsApp via Kapso si esta configurado, sino
    simulador SMS).
    """
    from ahora.orchestrator.pipelines import PIPELINES
    from ahora.orchestrator.runner import execute, start_run

    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT cuenca_id FROM municipality_cuenca "
                "WHERE municipality_id = :m LIMIT 1"
            ),
            {"m": municipality_id},
        )
        row = res.first()
    if not row:
        raise HTTPException(404, f"municipalidad '{municipality_id}' sin cuencas asignadas")

    cuenca_id = row[0]
    # Usar el replay del Rimac 2017 para forzar severidad EXTREMA
    payload = {"event": "rimac-2017-03-15" if cuenca_id == "rimac" else "piura-2017-03-27"}
    run_id = await start_run("replay", payload)
    result = await execute(PIPELINES["replay"], run_id, payload)
    return result


@router.get("/system")
async def get_system_config() -> dict[str, Any]:
    """Estado global del sistema (sin secretos)."""
    info: dict[str, Any] = {
        "kapso_configured": kapso.enabled,
        "kapso_phone_number_id": settings.kapso_phone_number_id or None,
        "kapso_template_configured": bool(settings.kapso_template_id),
        "kapso_can_send_real": kapso.can_send_real,
        "monitor_interval_minutes": settings.monitor_interval_minutes,
        "gee_mock_mode": settings.gee_mock_mode,
    }
    if kapso.enabled:
        try:
            phones = await kapso.list_phone_numbers()
            info["kapso_phone_numbers"] = [
                {
                    "id": p.get("phone_number_id") or p.get("id"),
                    "name": p.get("display_name") or p.get("name"),
                    "kind": p.get("kind"),
                }
                for p in (phones.get("data") or [])
            ]
        except Exception as exc:  # noqa: BLE001
            info["kapso_phone_numbers_error"] = str(exc)
    return info
