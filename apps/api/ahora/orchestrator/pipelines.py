"""Pipelines definidos: monitor diario y replay histórico.

Cada step es una función async que recibe `context` (dict con payload + outputs
de steps previos) y devuelve un dict JSON-serializable (queda en `workflow_step.output`).
"""
from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlalchemy import text

from ahora.db import get_session
from ahora.gee.ivc import compute_ivc
from ahora.gee.precipitation import get_chirps_daily, get_gfs_forecast
from ahora.logging_setup import log
from ahora.models import IvcParams
from ahora.orchestrator.runner import Pipeline


# Eventos históricos para replay (fechas + magnitudes documentadas)
REPLAY_EVENTS: dict[str, dict[str, Any]] = {
    "rimac-2017-03-15": {
        "cuenca_id": "rimac",
        "fecha": "2017-03-15",
        "mm_24h_mean": 38.0,
        "mm_24h_max": 95.0,
        "descripcion": "Huaico Carretera Central — quebrada Pedregal Chico",
    },
    "piura-2017-03-27": {
        "cuenca_id": "piura",
        "fecha": "2017-03-27",
        "mm_24h_mean": 115.0,
        "mm_24h_max": 220.0,
        "descripcion": "El Niño Costero — desborde río Piura",
    },
    "lima-2023-03-13": {
        "cuenca_id": "rimac",
        "fecha": "2023-03-13",
        "mm_24h_mean": 22.0,
        "mm_24h_max": 78.0,
        "descripcion": "Ciclón Yaku — lluvias en Lima costera",
    },
}


# ─────────────────────────────────────────────────────────
# Helpers compartidos
# ─────────────────────────────────────────────────────────
async def _load_cuenca(cuenca_id: str) -> dict[str, Any]:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT id, nombre, foco, ST_X(centro) AS lon, ST_Y(centro) AS lat, zoom, "
                "       ST_AsGeoJSON(geom_aoi) AS aoi_geojson "
                "FROM cuenca WHERE id=:id"
            ),
            {"id": cuenca_id},
        )
        row = res.first()
        if not row:
            raise ValueError(f"cuenca '{cuenca_id}' no existe")
        return {
            "id": row[0],
            "nombre": row[1],
            "foco": row[2],
            "lon": float(row[3]),
            "lat": float(row[4]),
            "zoom": int(row[5]),
            "aoi_geojson": json.loads(row[6]) if row[6] else None,
        }


async def _threshold(cuenca_id: str) -> float:
    async with get_session() as s:
        res = await s.execute(
            text("SELECT p95_mm_24h FROM rain_threshold WHERE cuenca_id=:c"),
            {"c": cuenca_id},
        )
        row = res.first()
        return float(row[0]) if row else 20.0


# ─────────────────────────────────────────────────────────
# Pipeline 1: monitor diario
# ─────────────────────────────────────────────────────────
monitor_pipeline = Pipeline(name="monitor")


@monitor_pipeline.step("load-cuenca", retries=2)
async def _step_load_cuenca(ctx: dict[str, Any]) -> dict[str, Any]:
    cuenca_id = ctx["payload"]["cuenca_id"]
    return await _load_cuenca(cuenca_id)


@monitor_pipeline.step("fetch-forecast", retries=3)
async def _step_fetch_forecast(ctx: dict[str, Any]) -> dict[str, Any]:
    cuenca = ctx["load-cuenca"]
    geom = (cuenca["lon"], cuenca["lat"], 15000)
    return get_gfs_forecast(cuenca["id"], geom, hours=48)


@monitor_pipeline.step("compute-threshold", retries=2)
async def _step_threshold(ctx: dict[str, Any]) -> dict[str, Any]:
    cuenca = ctx["load-cuenca"]
    return {"p95_mm_24h": await _threshold(cuenca["id"])}


@monitor_pipeline.step("evaluate-trigger")
async def _step_eval(ctx: dict[str, Any]) -> dict[str, Any]:
    forecast = ctx["fetch-forecast"]
    thr = ctx["compute-threshold"]["p95_mm_24h"]
    forecast_max = forecast.get("mm_24h_max") or 0
    trigger = forecast_max > thr
    return {
        "trigger": trigger,
        "forecast_mm_24h_max": forecast_max,
        "threshold": thr,
    }


@monitor_pipeline.step("load-ivc", retries=2)
async def _step_ivc(ctx: dict[str, Any]) -> dict[str, Any]:
    if not ctx["evaluate-trigger"]["trigger"]:
        return {"skipped": True}
    cuenca = ctx["load-cuenca"]
    geom = (cuenca["lon"], cuenca["lat"], 15000)
    return compute_ivc(cuenca["id"], geom, IvcParams())


@monitor_pipeline.step("persist-event")
async def _step_persist(ctx: dict[str, Any]) -> dict[str, Any]:
    trig = ctx["evaluate-trigger"]
    if not trig["trigger"]:
        log.info("monitor.no_trigger", **trig)
        return {"created": False}
    cuenca = ctx["load-cuenca"]
    ivc = ctx["load-ivc"]
    forecast = ctx["fetch-forecast"]
    severity = _severity(trig["forecast_mm_24h_max"], trig["threshold"])
    msg = (
        f"🚨 ALERTA {severity.upper()} — {cuenca['nombre']} ({cuenca['foco'] or ''})\n"
        f"Pronóstico 24h: {trig['forecast_mm_24h_max']:.0f} mm (p95 local: {trig['threshold']:.0f} mm).\n"
        f"IVC máx: {ivc.get('ivc_max', 'N/D')}. Población en riesgo: ~{ivc.get('pop_high_risk', 0)}."
    )

    async with get_session() as s:
        res = await s.execute(
            text(
                "INSERT INTO alert_event "
                "(run_id, cuenca_id, severity, message, pop_estimated, rain_mm_24h, ivc_max, meta) "
                "VALUES (:rid, :c, :sev, :msg, :pop, :rain, :ivc, CAST(:meta AS JSONB)) "
                "RETURNING id"
            ),
            {
                "rid": ctx["run_id"],
                "c": cuenca["id"],
                "sev": severity,
                "msg": msg,
                "pop": ivc.get("pop_high_risk"),
                "rain": trig["forecast_mm_24h_max"],
                "ivc": ivc.get("ivc_max"),
                "meta": json.dumps({"forecast": forecast, "ivc": ivc}),
            },
        )
        event_id = res.scalar_one()
        await s.commit()

    log.info("alert.created", event_id=str(event_id), severity=severity)
    return {"created": True, "event_id": str(event_id), "severity": severity, "message": msg}


@monitor_pipeline.step("notify-console")
async def _step_notify(ctx: dict[str, Any]) -> dict[str, Any]:
    """Notificación por consola (modo demo). Encola en sms_outbox e imprime."""
    pers = ctx["persist-event"]
    if not pers.get("created"):
        return {"notified": 0}

    cuenca = ctx["load-cuenca"]
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT s.id, s.telefono, s.nombre "
                "FROM subscriber s, cuenca c "
                "WHERE c.id=:c AND ST_DWithin(s.zona::geography, c.centro::geography, 20000) "
                "  AND s.activo=true"
            ),
            {"c": cuenca["id"]},
        )
        subs = res.fetchall()

        for sub_id, telefono, nombre in subs:
            await s.execute(
                text(
                    "INSERT INTO sms_outbox (event_id, subscriber_id, telefono, body, status) "
                    "VALUES (:e, :s, :t, :b, 'sent') "
                    "ON CONFLICT (event_id, telefono) DO NOTHING"
                ),
                {"e": pers["event_id"], "s": sub_id, "t": telefono, "b": pers["message"]},
            )
            # canal demo = stdout
            print("\n" + "─" * 60)
            print(f"📱 SMS → {nombre} ({telefono})")
            print(pers["message"])
            print("─" * 60)
        await s.commit()

    return {"notified": len(subs)}


# ─────────────────────────────────────────────────────────
# Pipeline 2: replay histórico
# ─────────────────────────────────────────────────────────
replay_pipeline = Pipeline(name="replay")


@replay_pipeline.step("load-event")
async def _replay_load(ctx: dict[str, Any]) -> dict[str, Any]:
    event_key = ctx["payload"]["event"]
    if event_key not in REPLAY_EVENTS:
        raise ValueError(f"event '{event_key}' no existe")
    return REPLAY_EVENTS[event_key]


@replay_pipeline.step("load-cuenca", retries=2)
async def _replay_cuenca(ctx: dict[str, Any]) -> dict[str, Any]:
    return await _load_cuenca(ctx["load-event"]["cuenca_id"])


@replay_pipeline.step("inject-rain")
async def _replay_rain(ctx: dict[str, Any]) -> dict[str, Any]:
    ev = ctx["load-event"]
    fecha = date.fromisoformat(ev["fecha"])
    async with get_session() as s:
        await s.execute(
            text(
                "INSERT INTO rain_daily (cuenca_id, fecha, fuente, mm_24h_mean, mm_24h_max) "
                "VALUES (:c, :f, 'replay', :mean, :max) "
                "ON CONFLICT (cuenca_id, fecha, fuente) DO UPDATE SET "
                "  mm_24h_mean=EXCLUDED.mm_24h_mean, mm_24h_max=EXCLUDED.mm_24h_max"
            ),
            {"c": ev["cuenca_id"], "f": fecha, "mean": ev["mm_24h_mean"], "max": ev["mm_24h_max"]},
        )
        await s.commit()
    return ev


@replay_pipeline.step("load-ivc", retries=2)
async def _replay_ivc(ctx: dict[str, Any]) -> dict[str, Any]:
    cuenca = ctx["load-cuenca"]
    geom = (cuenca["lon"], cuenca["lat"], 15000)
    return compute_ivc(cuenca["id"], geom, IvcParams())


@replay_pipeline.step("persist-event")
async def _replay_persist(ctx: dict[str, Any]) -> dict[str, Any]:
    ev = ctx["load-event"]
    cuenca = ctx["load-cuenca"]
    ivc = ctx["load-ivc"]
    thr = await _threshold(cuenca["id"])
    severity = _severity(ev["mm_24h_max"], thr)
    msg = (
        f"🚨 ALERTA {severity.upper()} — {cuenca['nombre']} ({cuenca['foco'] or ''})\n"
        f"{ev['descripcion']}.\n"
        f"Lluvia simulada 24h: {ev['mm_24h_max']:.0f} mm. IVC máx: {ivc.get('ivc_max')}."
        f"\nPoblación estimada en riesgo: ~{ivc.get('pop_high_risk', 0)}."
    )

    async with get_session() as s:
        res = await s.execute(
            text(
                "INSERT INTO alert_event "
                "(run_id, cuenca_id, severity, message, pop_estimated, rain_mm_24h, ivc_max, meta) "
                "VALUES (:rid, :c, :sev, :msg, :pop, :rain, :ivc, CAST(:meta AS JSONB)) "
                "RETURNING id"
            ),
            {
                "rid": ctx["run_id"],
                "c": cuenca["id"],
                "sev": severity,
                "msg": msg,
                "pop": ivc.get("pop_high_risk"),
                "rain": ev["mm_24h_max"],
                "ivc": ivc.get("ivc_max"),
                "meta": json.dumps({"replay": ev, "ivc": ivc}),
            },
        )
        event_id = res.scalar_one()
        await s.commit()
    return {"event_id": str(event_id), "severity": severity, "message": msg}


@replay_pipeline.step("notify-console")
async def _replay_notify(ctx: dict[str, Any]) -> dict[str, Any]:
    pers = ctx["persist-event"]
    cuenca = ctx["load-cuenca"]
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT s.id, s.telefono, s.nombre "
                "FROM subscriber s, cuenca c "
                "WHERE c.id=:c AND ST_DWithin(s.zona::geography, c.centro::geography, 20000) "
                "  AND s.activo=true"
            ),
            {"c": cuenca["id"]},
        )
        subs = res.fetchall()
        for sub_id, telefono, nombre in subs:
            await s.execute(
                text(
                    "INSERT INTO sms_outbox (event_id, subscriber_id, telefono, body, status) "
                    "VALUES (:e, :s, :t, :b, 'sent') "
                    "ON CONFLICT (event_id, telefono) DO NOTHING"
                ),
                {"e": pers["event_id"], "s": sub_id, "t": telefono, "b": pers["message"]},
            )
            print("\n" + "─" * 60)
            print(f"📱 SMS [REPLAY] → {nombre} ({telefono})")
            print(pers["message"])
            print("─" * 60)
        await s.commit()
    return {"notified": len(subs)}


# ─────────────────────────────────────────────────────────
# Util
# ─────────────────────────────────────────────────────────
def _severity(rain_mm: float, p95: float) -> str:
    ratio = rain_mm / max(p95, 1.0)
    if ratio >= 4:
        return "extreme"
    if ratio >= 2:
        return "high"
    if ratio >= 1.2:
        return "medium"
    return "low"


PIPELINES: dict[str, Pipeline] = {
    "monitor": monitor_pipeline,
    "replay": replay_pipeline,
}
