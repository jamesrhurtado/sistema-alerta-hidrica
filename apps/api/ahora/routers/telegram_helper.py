"""Helpers para configurar Telegram desde el dashboard."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from ahora.db import get_session
from ahora.notify.telegram import telegram

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.get("/status")
async def status() -> dict[str, Any]:
    """Estado global del bot Telegram."""
    if not telegram.enabled:
        return {"configured": False}
    me = await telegram.get_me()
    if not me:
        return {"configured": True, "reachable": False}
    return {
        "configured": True,
        "reachable": True,
        "bot_username": me.get("username"),
        "bot_name": me.get("first_name"),
        "bot_id": me.get("id"),
    }


@router.get("/recent-chats")
async def recent_chats() -> dict[str, Any]:
    """Lista los chats recientes que escribieron al bot.

    Util para que el admin descubra el chat_id de su canal/grupo despues de
    mandar un /start o invitar al bot al canal.
    """
    if not telegram.enabled:
        return {"configured": False, "chats": []}
    updates = await telegram.get_updates(limit=20)
    chats: dict[str, dict[str, Any]] = {}
    for u in updates:
        msg = u.get("message") or u.get("channel_post") or u.get("my_chat_member") or {}
        chat = msg.get("chat") or {}
        if not chat.get("id"):
            continue
        cid = str(chat["id"])
        if cid not in chats:
            chats[cid] = {
                "chat_id": cid,
                "type": chat.get("type"),
                "title": chat.get("title"),
                "username": chat.get("username"),
                "first_name": chat.get("first_name"),
            }
    return {"configured": True, "chats": list(chats.values())}


class TelegramSet(BaseModel):
    telegram_chat_id: str | None = None
    telegram_username: str | None = None


@router.patch("/municipality/{municipality_id}")
async def set_municipality_telegram(
    municipality_id: str, body: TelegramSet
) -> dict[str, Any]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "UPDATE municipality SET "
                "  telegram_chat_id = COALESCE(:cid, telegram_chat_id), "
                "  telegram_username = COALESCE(:un, telegram_username) "
                "WHERE id = :id "
                "RETURNING telegram_chat_id, telegram_username"
            ),
            {
                "id": municipality_id,
                "cid": body.telegram_chat_id,
                "un": body.telegram_username,
            },
        )
        row = res.first()
        if not row:
            raise HTTPException(404, f"municipalidad '{municipality_id}' no existe")
        await s.commit()
    return {
        "municipality_id": municipality_id,
        "telegram_chat_id": row[0],
        "telegram_username": row[1],
    }


@router.post("/municipality/{municipality_id}/test")
async def test_send(municipality_id: str) -> dict[str, Any]:
    """Envia un mensaje de prueba al canal configurado."""
    if not telegram.enabled:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN no configurado")

    async with get_session() as s:
        res = await s.execute(
            text("SELECT nombre, telegram_chat_id FROM municipality WHERE id = :id"),
            {"id": municipality_id},
        )
        row = res.first()
    if not row:
        raise HTTPException(404, f"municipalidad '{municipality_id}' no existe")
    nombre, chat_id = row[0], row[1]
    if not chat_id:
        raise HTTPException(400, "Esta municipalidad no tiene canal Telegram configurado")

    msg = (
        f"✅ *Prueba AHORA — {nombre}*\n\n"
        f"Si recibes este mensaje, las alertas reales funcionarán cuando haya una emergencia.\n\n"
        f"_Sistema de Alerta Hidrica Oportuna._"
    )
    result = await telegram.send(chat_id, msg)
    return {"municipality_id": municipality_id, "chat_id": chat_id, **result}
