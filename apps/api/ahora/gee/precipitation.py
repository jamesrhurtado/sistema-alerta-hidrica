"""Lluvia: CHIRPS (retrospectivo) + GFS (pronóstico). Con fallback mock."""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from typing import Any

from ahora.gee.auth import init_gee, is_mock


def _mock_rain(cuenca_id: str, days: int, seed_extra: str = "") -> list[dict[str, Any]]:
    rnd = random.Random(f"{cuenca_id}:{seed_extra}:{days}")
    today = date.today()
    out: list[dict[str, Any]] = []
    for i in range(days):
        d = today - timedelta(days=days - i)
        base = rnd.gauss(8 if cuenca_id == "rimac" else 12, 4)
        out.append({
            "fecha": d.isoformat(),
            "mm_24h_mean": round(max(0, base), 2),
            "mm_24h_max": round(max(0, base * rnd.uniform(1.5, 3.0)), 2),
        })
    return out


def get_chirps_daily(cuenca_id: str, geom_aoi: Any, days: int = 30) -> list[dict[str, Any]]:
    """Retorna serie diaria CHIRPS de los últimos N días."""
    init_gee()
    if is_mock():
        return _mock_rain(cuenca_id, days, "chirps")

    import ee  # type: ignore
    end = ee.Date(datetime.utcnow().isoformat()[:10])
    start = end.advance(-days, "day")
    coll = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate(start, end)
        .filterBounds(_to_ee_geom(geom_aoi))
    )

    def reduce_one(img):
        v = img.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True),
            geometry=_to_ee_geom(geom_aoi),
            scale=5000,
            maxPixels=1e10,
            bestEffort=True,
        )
        return ee.Feature(None, {
            "fecha": img.date().format("YYYY-MM-dd"),
            "mm_24h_mean": v.get("precipitation_mean"),
            "mm_24h_max": v.get("precipitation_max"),
        })

    feats = coll.map(reduce_one).getInfo()["features"]
    return [f["properties"] for f in feats]


def get_gfs_forecast(cuenca_id: str, geom_aoi: Any, hours: int = 48) -> dict[str, Any]:
    """Acumulado de lluvia pronosticado para las próximas N horas."""
    init_gee()
    if is_mock():
        mock = _mock_rain(cuenca_id, 1, f"gfs-{hours}")[0]
        # Para demo: a veces (~15%) generamos pronóstico extremo
        rnd = random.Random(f"gfs:{cuenca_id}:{date.today()}")
        if rnd.random() < 0.15:
            mock["mm_24h_max"] = round(rnd.uniform(60, 120), 2)
            mock["mm_24h_mean"] = round(mock["mm_24h_max"] * 0.6, 2)
        return {"horizon_hours": hours, **mock}

    import ee  # type: ignore

    # GFS0P25: forecast_hours=0 no tiene precip acumulada (estado inicial).
    # Solo horas > 0 traen total_precipitation_surface. Tomamos las ultimas
    # corridas (corren cada 6h: 00, 06, 12, 18 UTC) y filtramos a horizonte.
    coll = (
        ee.ImageCollection("NOAA/GFS0P25")
        .filterDate(
            ee.Date(ee.Date(int(__import__("time").time() * 1000)).advance(-12, "hour")),
            ee.Date(int(__import__("time").time() * 1000)).advance(hours, "hour"),
        )
        .filter(ee.Filter.gt("forecast_hours", 0))
        .filter(ee.Filter.lte("forecast_hours", hours))
        .select("total_precipitation_surface")
    )
    try:
        total = coll.sum().reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True),
            geometry=_to_ee_geom(geom_aoi),
            scale=10000,
            bestEffort=True,
        ).getInfo()
        mean_v = total.get("total_precipitation_surface_mean") or 0
        max_v = total.get("total_precipitation_surface_max") or 0
    except Exception as exc:  # noqa: BLE001
        # GFS data acumulada puede no estar siempre disponible. Caemos a CHIRPS
        # del ultimo dia como aproximacion.
        from ahora.logging_setup import log as _log
        _log.warning("gfs.fallback_chirps", error=str(exc))
        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY") \
            .filterDate(ee.Date(int(__import__("time").time() * 1000)).advance(-2, "day"),
                        ee.Date(int(__import__("time").time() * 1000)))
        try:
            r = chirps.sum().reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True),
                geometry=_to_ee_geom(geom_aoi),
                scale=5000,
                bestEffort=True,
            ).getInfo()
            mean_v = r.get("precipitation_mean") or 0
            max_v = r.get("precipitation_max") or 0
        except Exception:  # noqa: BLE001
            mean_v = 0
            max_v = 0
    return {
        "horizon_hours": hours,
        "mm_24h_mean": mean_v,
        "mm_24h_max": max_v,
    }


def _to_ee_geom(g: Any):
    import ee  # type: ignore
    if isinstance(g, dict):
        return ee.Geometry(g)
    if isinstance(g, tuple) and len(g) == 3:
        lon, lat, r = g
        return ee.Geometry.Point([lon, lat]).buffer(r)
    raise ValueError("geom no soportada")
