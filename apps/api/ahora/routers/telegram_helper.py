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
    telegram_bot_token: str | None = None  # NULL/"" = usar bot del sistema


@router.patch("/municipality/{municipality_id}")
async def set_municipality_telegram(
    municipality_id: str, body: TelegramSet
) -> dict[str, Any]:
    # Si el bot_token llega como string vacio, lo guardamos como NULL
    # para que la muni vuelva a usar el bot del sistema.
    token = body.telegram_bot_token
    if token is not None and token.strip() == "":
        token = None

    async with get_session() as s:
        res = await s.execute(
            text(
                "UPDATE municipality SET "
                "  telegram_chat_id = COALESCE(:cid, telegram_chat_id), "
                "  telegram_username = COALESCE(:un, telegram_username), "
                "  telegram_bot_token = CASE "
                "    WHEN :token_provided THEN :token "
                "    ELSE telegram_bot_token "
                "  END "
                "WHERE id = :id "
                "RETURNING telegram_chat_id, telegram_username, telegram_bot_token"
            ),
            {
                "id": municipality_id,
                "cid": body.telegram_chat_id,
                "un": body.telegram_username,
                "token": token,
                "token_provided": body.telegram_bot_token is not None,
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
        "telegram_has_custom_token": row[2] is not None,
    }


@router.post("/municipality/{municipality_id}/test")
async def test_send(municipality_id: str) -> dict[str, Any]:
    """Envia un mensaje de prueba al canal configurado."""
    from ahora.notify.telegram import bot_for

    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT nombre, telegram_chat_id, telegram_bot_token "
                "FROM municipality WHERE id = :id"
            ),
            {"id": municipality_id},
        )
        row = res.first()
    if not row:
        raise HTTPException(404, f"municipalidad '{municipality_id}' no existe")
    nombre, chat_id, muni_token = row[0], row[1], row[2]
    if not chat_id:
        raise HTTPException(400, "Esta municipalidad no tiene canal Telegram configurado")

    bot = bot_for(muni_token)
    if not bot.enabled:
        raise HTTPException(400, "Ni el bot del sistema ni el de la municipalidad estan configurados")

    msg = (
        f"✅ *Prueba AHORA — {nombre}*\n\n"
        f"Si recibes este mensaje, las alertas reales funcionaran cuando haya una emergencia.\n\n"
        f"_Sistema de Alerta Hidrica Oportuna._"
    )
    result = await bot.send(chat_id, msg)
    return {"municipality_id": municipality_id, "chat_id": chat_id, **result}
