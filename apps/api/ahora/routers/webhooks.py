"""Webhooks externos. Por ahora solo Kapso (opt-in WhatsApp)."""
from __future__ import annotations

import hmac
import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import text

from ahora.config import settings
from ahora.db import get_session
from ahora.logging_setup import log

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_signature(raw_body: bytes, signature: str | None) -> bool:
    secret = settings.kapso_webhook_secret
    if not secret:
        return True  # sin secret configurado, aceptamos (solo dev)
    if not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/kapso")
async def kapso_webhook(
    request: Request,
    x_kapso_signature: str | None = Header(None),
) -> dict[str, Any]:
    raw = await request.body()
    if not _verify_signature(raw, x_kapso_signature):
        raise HTTPException(401, "bad signature")

    payload = json.loads(raw or b"{}")
    event_type = payload.get("event") or payload.get("type")

    # Evento de opt-in: el residente confirmó suscripción + compartió ubicación
    if event_type == "opt_in":
        muni_id = payload.get("municipality_hint") or payload.get("municipality_id")
        phone = payload.get("wa_number") or payload.get("phone")
        nombre = payload.get("nombre") or payload.get("name")
        loc = payload.get("ubicacion") or payload.get("location") or {}
        lon = loc.get("lon") or loc.get("longitude")
        lat = loc.get("lat") or loc.get("latitude")
        if not (muni_id and phone and lon and lat):
            raise HTTPException(400, "missing required fields for opt_in")

        async with get_session() as s:
            await s.execute(
                text(
                    "INSERT INTO subscriber "
                    "(municipality_id, nombre, telefono, zona, rol, canal, opt_in_at, activo) "
                    "VALUES (:m, :n, :t, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), "
                    "        'residente', 'whatsapp', :ts, true) "
                    "ON CONFLICT (telefono) DO UPDATE SET "
                    "  zona = EXCLUDED.zona, "
                    "  opt_in_at = EXCLUDED.opt_in_at, "
                    "  activo = true, "
                    "  municipality_id = EXCLUDED.municipality_id"
                ),
                {
                    "m": muni_id, "n": nombre, "t": phone,
                    "lon": float(lon), "lat": float(lat),
                    "ts": datetime.now(UTC),
                },
            )
            await s.commit()

        log.info("kapso.opt_in", municipality=muni_id, phone=phone)
        return {"ok": True, "subscribed": True}

    # Evento STOP / opt-out
    if event_type in {"opt_out", "stop"}:
        phone = payload.get("wa_number") or payload.get("phone")
        if not phone:
            raise HTTPException(400, "missing phone")
        async with get_session() as s:
            await s.execute(
                text("UPDATE subscriber SET activo = false WHERE telefono = :t"),
                {"t": phone},
            )
            await s.commit()
        log.info("kapso.opt_out", phone=phone)
        return {"ok": True, "unsubscribed": True}

    # Para otros tipos, solo log
    log.info("kapso.webhook_received", event_type=event_type)
    return {"ok": True, "ignored": True}
