"""Detección de inundación con Sentinel-1 SAR.

Port directo de `detectarInundacionS1()` del prototipo AGUA & ASFALTO v3.
Usa el contraste pre/post evento en banda VH (descending) para detectar
píxeles que pasaron de "tierra" a "agua" (umbral VH < -17 dB + diferencia > 3 dB).

Esto NO requiere disparar alertas — es análisis retrospectivo del daño real
para entender la magnitud de un evento histórico.
"""
from __future__ import annotations

import random
import time
from typing import Any

from ahora.gee.auth import init_gee, is_mock
from ahora.logging_setup import log


# Ventanas pre/post evento por id de evento histórico.
EVENT_WINDOWS: dict[str, dict[str, Any]] = {
    "rimac-2017-03-15": {
        "cuenca_id": "rimac",
        "label": "Huaico Carretera Central — marzo 2017",
        "pre_dates": ("2016-12-01", "2017-01-31"),
        "post_dates": ("2017-03-10", "2017-03-31"),
        "alert_lead_hours": 18,
        "damage_summary": "Carretera Central bloqueada 5 días, 6 muertos, ~800 damnificados en Chosica/Chaclacayo.",
    },
    "piura-2017-03-27": {
        "cuenca_id": "piura",
        "label": "El Niño Costero — desborde río Piura, marzo 2017",
        "pre_dates": ("2016-11-01", "2016-12-31"),
        "post_dates": ("2017-03-20", "2017-04-15"),
        "alert_lead_hours": 24,
        "damage_summary": "Más de 40 muertos, 200,000+ damnificados, 24,400 viviendas inutilizables solo en Piura.",
    },
    "lima-2023-03-13": {
        "cuenca_id": "rimac",
        "label": "Ciclón Yaku — Lima costera, marzo 2023",
        "pre_dates": ("2022-11-01", "2023-01-15"),
        "post_dates": ("2023-03-01", "2023-04-15"),
        "alert_lead_hours": 12,
        "damage_summary": "Ciclón Yaku: 99 muertos en Perú, 370,000 afectados, ~24,400 viviendas colapsadas.",
    },
}


def _mock_analysis(event_id: str) -> dict[str, Any]:
    ev = EVENT_WINDOWS.get(event_id, {})
    rnd = random.Random(event_id)
    return {
        "event_id": event_id,
        "label": ev.get("label", event_id),
        "tile_urls": {},
        "stats": {
            "ha_inundadas": round(rnd.uniform(50, 200), 1),
            "ha_urbano_inundado": round(rnd.uniform(10, 60), 1),
            "pop_afectada": rnd.randint(800, 4000),
        },
        "alert_lead_hours": ev.get("alert_lead_hours"),
        "damage_summary": ev.get("damage_summary"),
        "mock": True,
    }


def analyze_historical_event(event_id: str, cuenca_aoi: tuple[float, float, float]) -> dict[str, Any]:
    """Analiza un evento histórico via Sentinel-1. Devuelve tile URLs + stats reales."""
    if event_id not in EVENT_WINDOWS:
        raise ValueError(f"evento '{event_id}' no soportado")
    cfg = EVENT_WINDOWS[event_id]

    init_gee()
    if is_mock():
        return _mock_analysis(event_id)

    import ee  # type: ignore
    t0 = time.time()
    lon, lat, radius = cuenca_aoi
    aoi = ee.Geometry.Point([lon, lat]).buffer(radius)

    pre_start, pre_end = cfg["pre_dates"]
    post_start, post_end = cfg["post_dates"]

    # Sin filtrar por orbit_pass: para 2016-2017 en Peru la cobertura SAR
    # descendente era irregular. Mezclar ASC/DESC mantiene mas imagenes.
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filterBounds(aoi)
        .select("VH")
    )
    pre_coll = s1.filterDate(pre_start, pre_end)
    post_coll = s1.filterDate(post_start, post_end)

    pre_count = int(pre_coll.size().getInfo() or 0)
    post_count = int(post_coll.size().getInfo() or 0)
    if pre_count == 0 or post_count == 0:
        raise RuntimeError(
            f"Sentinel-1 sin imagenes para {event_id}: "
            f"pre={pre_count} ({pre_start}..{pre_end}), "
            f"post={post_count} ({post_start}..{post_end})"
        )

    pre_img = pre_coll.median().clip(aoi)
    post_img = post_coll.median().clip(aoi)
    diff = pre_img.subtract(post_img)
    inundacion = post_img.lt(-17).And(diff.gt(3))

    # Cruce con urbano (GHSL al año del evento)
    ghsl = ee.ImageCollection("JRC/GHSL/P2023A/GHS_BUILT_S")
    year_evento = int(post_end[:4])
    year_ghsl = min(2020, max(1990, (year_evento // 5) * 5))
    built = (
        ghsl.filter(ee.Filter.calendarRange(year_ghsl, year_ghsl, "year"))
        .first()
        .select("built_surface")
        .gte(500)
        .clip(aoi)
    )
    inund_urbano = inundacion.And(built)

    # Población afectada (GHSL pop)
    pop = (
        ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP")
        .filter(ee.Filter.calendarRange(year_ghsl, year_ghsl, "year"))
        .first()
        .select("population_count")
        .clip(aoi)
    )

    # Stats
    px = ee.Image.pixelArea()
    stats_img = (
        inundacion.multiply(px).rename("area_inund")
        .addBands(inund_urbano.multiply(px).rename("area_inund_urb"))
        .addBands(pop.updateMask(inundacion).rename("pop_inund"))
    )
    stats = stats_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=aoi, scale=30, maxPixels=int(1e10), bestEffort=True,
    ).getInfo()

    ha_inund = round((stats.get("area_inund") or 0) / 10000, 1)
    ha_inund_urb = round((stats.get("area_inund_urb") or 0) / 10000, 1)
    pop_afectada = int(stats.get("pop_inund") or 0)

    # Tile URLs
    def to_tile(image, vis):
        return image.getMapId(vis)["tile_fetcher"].url_format

    tile_urls = {
        "pre": to_tile(pre_img, {"min": -25, "max": 0, "palette": ["black", "white"]}),
        "post": to_tile(post_img, {"min": -25, "max": 0, "palette": ["black", "white"]}),
        "inundacion": to_tile(
            inundacion.selfMask(), {"palette": ["#00ffff"]}
        ),
        "inund_urbano": to_tile(
            inund_urbano.selfMask(), {"palette": ["#ff00ff"]}
        ),
    }

    dt = round(time.time() - t0, 2)
    log.info(
        "gee.s1_analysis_built",
        event_key=event_id, seconds=dt,
        ha_inund=ha_inund, pop=pop_afectada,
    )

    return {
        "event_id": event_id,
        "label": cfg["label"],
        "cuenca_id": cfg["cuenca_id"],
        "pre_dates": cfg["pre_dates"],
        "post_dates": cfg["post_dates"],
        "tile_urls": tile_urls,
        "stats": {
            "ha_inundadas": ha_inund,
            "ha_urbano_inundado": ha_inund_urb,
            "pop_afectada": pop_afectada,
        },
        "alert_lead_hours": cfg["alert_lead_hours"],
        "damage_summary": cfg["damage_summary"],
        "build_seconds": dt,
        "mock": False,
    }
