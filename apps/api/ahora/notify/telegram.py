"""Cliente de Telegram. Un bot envia alertas a multiples canales/chats.

A diferencia de WhatsApp Business:
- Sin plantillas Meta, sin aprobacion
- Sin webhook obligatorio
- Gratis y sin limites razonables
- Setup en 2 minutos via @BotFather
"""
from __future__ import annotations

from typing import Any

import httpx

from ahora.config import settings
from ahora.logging_setup import log


class TelegramBot:
    def __init__(self, token: str | None = None) -> None:
        self.token = token or settings.telegram_bot_token

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    @property
    def base(self) -> str:
        return f"https://api.telegram.org/bot{self.token}"

    async def get_me(self) -> dict[str, Any] | None:
        """Verifica que el token es valido y devuelve datos del bot."""
        if not self.enabled:
            return None
        async with httpx.AsyncClient(timeout=10.0) as cli:
            try:
                r = await cli.get(f"{self.base}/getMe")
                if r.status_code == 200 and r.json().get("ok"):
                    return r.json()["result"]
            except Exception as exc:  # noqa: BLE001
                log.warning("telegram.get_me_failed", error=str(exc))
        return None

    async def get_updates(self, limit: int = 10) -> list[dict[str, Any]]:
        """Para discovery: ver chats recientes que han interactuado con el bot.

        Util para que el admin descubra su chat_id despues de mandar /start.
        """
        if not self.enabled:
            return []
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.get(f"{self.base}/getUpdates", params={"limit": limit})
            if r.status_code == 200 and r.json().get("ok"):
                return r.json()["result"]
        return []

    async def send(
        self,
        chat_id: str,
        text: str,
        parse_mode: str = "Markdown",
    ) -> dict[str, Any]:
        if not self.enabled:
            return {"ok": False, "reason": "no_token"}
        async with httpx.AsyncClient(timeout=10.0) as cli:
            try:
                r = await cli.post(
                    f"{self.base}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": parse_mode,
                        "disable_web_page_preview": True,
                    },
                )
                data = r.json()
                if r.status_code == 200 and data.get("ok"):
                    log.info("telegram.sent", chat_id=chat_id, message_id=data["result"]["message_id"])
                    return {"ok": True, "message_id": data["result"]["message_id"]}
                log.error("telegram.send_failed", chat_id=chat_id, body=data)
                return {"ok": False, "error": data.get("description", "unknown")}
            except Exception as exc:  # noqa: BLE001
                log.error("telegram.send_error", chat_id=chat_id, error=str(exc))
                return {"ok": False, "error": str(exc)}


telegram = TelegramBot()
