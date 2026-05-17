"""Cliente de Kapso WhatsApp (auth X-API-Key, flujo de broadcasts).

Kapso usa el modelo estandar de WhatsApp Business API:
- Para enviar mensajes en frio se necesita una plantilla aprobada por Meta.
- Flujo: crear broadcast -> agregar recipients -> enviar.
- En sandbox (sin plantilla) solo se puede responder dentro de la ventana de
  24h despues que el usuario te haya escrito.

Endpoints:
  GET    /whatsapp/phone_numbers
  POST   /whatsapp/broadcasts                              (crear draft)
  POST   /whatsapp/broadcasts/{id}/recipients              (agregar destinos)
  POST   /whatsapp/broadcasts/{id}/send                    (lanzar envio)
"""
from __future__ import annotations

from typing import Any

import httpx

from ahora.config import settings
from ahora.logging_setup import log


class KapsoClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        phone_number_id: str | None = None,
        template_id: str | None = None,
    ) -> None:
        self.api_key = api_key or settings.kapso_api_key
        self.base_url = (base_url or settings.kapso_base_url).rstrip("/")
        self.phone_number_id = phone_number_id or settings.kapso_phone_number_id
        self.template_id = template_id or settings.kapso_template_id

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    @property
    def can_send_real(self) -> bool:
        return bool(self.api_key and self.phone_number_id and self.template_id)

    def _headers(self) -> dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def list_phone_numbers(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0) as cli:
            r = await cli.get(f"{self.base_url}/whatsapp/phone_numbers", headers=self._headers())
            r.raise_for_status()
            return r.json()

    async def send_alert_to_subscribers(
        self,
        recipients: list[dict[str, Any]],
        body_params: list[str],
        broadcast_name: str = "AHORA Alerta",
    ) -> dict[str, Any]:
        """Envia una alerta a N suscriptores via broadcast + plantilla.

        recipients: [{"phone_number": "+51...", "name": "..."}]
        body_params: ['EXTREMA', 'Chosica', 'Huaico en quebrada Pedregal', 'Defensa Civil']
        """
        if not self.can_send_real:
            return {
                "ok": False,
                "reason": "kapso_template_not_configured",
                "hint": "Configura KAPSO_TEMPLATE_ID con una plantilla Meta aprobada",
            }
        if not recipients:
            return {"ok": True, "skipped": True, "reason": "no_recipients"}

        async with httpx.AsyncClient(timeout=20.0) as cli:
            # 1. Crear broadcast en draft
            try:
                r1 = await cli.post(
                    f"{self.base_url}/whatsapp/broadcasts",
                    headers=self._headers(),
                    json={
                        "whatsapp_broadcast": {
                            "name": broadcast_name,
                            "phone_number_id": self.phone_number_id,
                            "whatsapp_template_id": self.template_id,
                        }
                    },
                )
                r1.raise_for_status()
                broadcast_id = r1.json()["data"]["id"]
            except Exception as exc:  # noqa: BLE001
                log.error("kapso.create_broadcast_failed", error=str(exc))
                return {"ok": False, "step": "create", "error": str(exc)}

            # 2. Agregar recipients (con parametros de plantilla)
            try:
                r2 = await cli.post(
                    f"{self.base_url}/whatsapp/broadcasts/{broadcast_id}/recipients",
                    headers=self._headers(),
                    json={
                        "recipients": [
                            {
                                "phone_number": r["phone_number"],
                                "template_variables": {
                                    str(i + 1): v for i, v in enumerate(body_params)
                                },
                                "name": r.get("name"),
                            }
                            for r in recipients
                        ]
                    },
                )
                r2.raise_for_status()
            except Exception as exc:  # noqa: BLE001
                log.error("kapso.add_recipients_failed", error=str(exc), broadcast_id=broadcast_id)
                return {"ok": False, "step": "recipients", "error": str(exc), "broadcast_id": broadcast_id}

            # 3. Enviar
            try:
                r3 = await cli.post(
                    f"{self.base_url}/whatsapp/broadcasts/{broadcast_id}/send",
                    headers=self._headers(),
                )
                r3.raise_for_status()
            except Exception as exc:  # noqa: BLE001
                log.error("kapso.send_broadcast_failed", error=str(exc), broadcast_id=broadcast_id)
                return {"ok": False, "step": "send", "error": str(exc), "broadcast_id": broadcast_id}

        log.info("kapso.broadcast_sent", broadcast_id=broadcast_id, recipients=len(recipients))
        return {"ok": True, "broadcast_id": broadcast_id, "recipients_count": len(recipients)}


kapso = KapsoClient()
