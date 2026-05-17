from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from sqlalchemy import text
from sse_starlette.sse import EventSourceResponse

from ahora.db import get_session

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(cuenca_id: str | None = None, limit: int = 50) -> list[dict[str, object]]:
    query = (
        "SELECT id, cuenca_id, severity, message, pop_estimated, rain_mm_24h, ivc_max, created_at "
        "FROM alert_event "
    )
    params: dict[str, object] = {"lim": limit}
    if cuenca_id:
        query += "WHERE cuenca_id=:c "
        params["c"] = cuenca_id
    query += "ORDER BY created_at DESC LIMIT :lim"

    async with get_session() as s:
        res = await s.execute(text(query), params)
        return [
            {
                "id": str(r[0]),
                "cuenca_id": r[1],
                "severity": r[2],
                "message": r[3],
                "pop_estimated": r[4],
                "rain_mm_24h": float(r[5]) if r[5] is not None else None,
                "ivc_max": float(r[6]) if r[6] is not None else None,
                "created_at": r[7].isoformat(),
            }
            for r in res.fetchall()
        ]


@router.get("/outbox")
async def list_outbox(limit: int = 100) -> list[dict[str, object]]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT o.id, o.telefono, o.body, o.status, o.sent_at, e.cuenca_id, e.severity "
                "FROM sms_outbox o JOIN alert_event e ON o.event_id=e.id "
                "ORDER BY o.sent_at DESC NULLS LAST LIMIT :lim"
            ),
            {"lim": limit},
        )
        return [
            {
                "id": str(r[0]),
                "telefono": r[1],
                "body": r[2],
                "status": r[3],
                "sent_at": r[4].isoformat() if r[4] else None,
                "cuenca_id": r[5],
                "severity": r[6],
            }
            for r in res.fetchall()
        ]


@router.get("/stream")
async def stream_alerts():
    """SSE: feed de alertas nuevas (poll cada 2 s contra Postgres)."""
    async def event_generator():
        last_seen = None
        while True:
            query = (
                "SELECT id, cuenca_id, severity, message, created_at "
                "FROM alert_event "
            )
            params: dict[str, object] = {}
            if last_seen is not None:
                query += "WHERE created_at > :last "
                params["last"] = last_seen
            query += "ORDER BY created_at DESC LIMIT 5"

            async with get_session() as s:
                res = await s.execute(text(query), params)
                rows = res.fetchall()

            for r in reversed(rows):  # más antiguo primero
                last_seen = r[4] if last_seen is None or r[4] > last_seen else last_seen
                yield {
                    "event": "alert",
                    "data": json.dumps({
                        "id": str(r[0]),
                        "cuenca_id": r[1],
                        "severity": r[2],
                        "message": r[3],
                        "created_at": r[4].isoformat(),
                    }),
                }

            await asyncio.sleep(2)

    return EventSourceResponse(event_generator())
