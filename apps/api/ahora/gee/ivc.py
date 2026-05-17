"""Cálculo del Índice de Vulnerabilidad Compuesto (IVC).

Port directo del prototipo `AGUA & ASFALTO v3.0` (Code Editor JS) a Python.
Pesos canónicos: 0.30 agua + 0.20 pendiente + 0.20 buffer + 0.15 built + 0.15 pop.

Si GEE está en MODO MOCK, devuelve un IVC sintético determinístico para
poder iterar el dashboard sin credenciales.
"""
from __future__ import annotations

import hashlib
import json
import random
from typing import Any

from ahora.gee.auth import init_gee, is_mock
from ahora.logging_setup import log
from ahora.models import IvcParams


def params_hash(params: IvcParams) -> str:
    raw = json.dumps(params.model_dump(), sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def compute_ivc_mock(cuenca_id: str, params: IvcParams) -> dict[str, Any]:
    """IVC sintético determinístico por cuenca (mock mode)."""
    rnd = random.Random(f"{cuenca_id}:{params_hash(params)}")
    ivc_mean = rnd.uniform(35, 55)
    ivc_max = rnd.uniform(75, 95)
    return {
        "ivc_mean": round(ivc_mean, 2),
        "ivc_max": round(ivc_max, 2),
        "pop_high_risk": rnd.randint(500, 5000),
        "area_urb_inund_ha": round(rnd.uniform(20, 80), 1),
        "tile_url": None,
        "geotiff_url": None,
        "mock": True,
    }


def compute_ivc(cuenca_id: str, geom_aoi: Any, params: IvcParams) -> dict[str, Any]:
    """Calcula IVC para una cuenca. Cae a mock si no hay GEE."""
    init_gee()
    if is_mock():
        return compute_ivc_mock(cuenca_id, params)

    import ee  # type: ignore

    aoi = _to_ee_geometry(geom_aoi)

    # ── Agua histórica (JRC GSW Yearly) ──
    gsw = (
        ee.ImageCollection("JRC/GSW1_4/YearlyHistory")
        .filter(ee.Filter.calendarRange(params.year_water_start, params.year_water_end, "year"))
        .map(lambda img: img.select("waterClass").gte(2).rename("w"))
        .sum()
        .clip(aoi)
    )
    total_years = params.year_water_end - params.year_water_start + 1
    n_agua = gsw.divide(total_years)

    # ── Pendiente ──
    dem = ee.Image("USGS/SRTMGL1_003")
    slope = ee.Terrain.slope(dem)
    n_slope = ee.Image(1).subtract(slope.divide(30).clamp(0, 1))

    # ── Buffer de cercanía a agua recurrente ──
    agua_rec = gsw.gte(3).unmask(0)
    dist = (
        agua_rec.fastDistanceTransform(256)
        .sqrt()
        .multiply(ee.Image.pixelArea().sqrt())
    )
    buffer_agua = dist.lte(params.buffer_m).clip(aoi)
    n_buffer = buffer_agua.toFloat()

    # ── Built / Pop (GHSL) ──
    ghsl = ee.ImageCollection("JRC/GHSL/P2023A/GHS_BUILT_S")
    ghsl_pop = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP")
    built = (
        ghsl.filter(ee.Filter.calendarRange(params.year_urb_end, params.year_urb_end, "year"))
        .first()
        .select("built_surface")
        .clip(aoi)
    )
    pop = (
        ghsl_pop.filter(ee.Filter.calendarRange(params.year_urb_end, params.year_urb_end, "year"))
        .first()
        .select("population_count")
        .clip(aoi)
    )
    n_built = built.divide(5000).clamp(0, 1)
    n_pop = pop.unmask(0).divide(50).clamp(0, 1)

    # ── Fórmula canónica del prototipo ──
    ivc = (
        n_agua.multiply(0.30)
        .add(n_slope.multiply(0.20))
        .add(n_buffer.multiply(0.20))
        .add(n_built.multiply(0.15))
        .add(n_pop.multiply(0.15))
        .multiply(100)
        .rename("ivc")
    )

    # Reducciones para resumen
    urb_mask = built.gte(params.built_threshold_m2)
    ivc_stats = (
        ivc.updateMask(urb_mask)
        .reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True),
            geometry=aoi,
            scale=100,
            maxPixels=1e13,
            bestEffort=True,
        )
        .getInfo()
    )
    pop_high = (
        pop.updateMask(ivc.gt(60))
        .reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=100,
            maxPixels=1e13,
            bestEffort=True,
        )
        .getInfo()
    )

    log.info("gee.ivc_computed", cuenca=cuenca_id, stats=ivc_stats)

    return {
        "ivc_mean": ivc_stats.get("ivc_mean"),
        "ivc_max": ivc_stats.get("ivc_max"),
        "pop_high_risk": int(pop_high.get("population_count") or 0),
        "area_urb_inund_ha": None,  # se calcula en módulo de simulación
        "tile_url": None,            # se genera en pipeline de tiles (F1.2)
        "geotiff_url": None,
        "mock": False,
    }


def _to_ee_geometry(geom_geojson: Any):
    """Acepta GeoJSON dict, WKT string o tupla (lon,lat,radius_m)."""
    import ee  # type: ignore

    if isinstance(geom_geojson, dict):
        return ee.Geometry(geom_geojson)
    if isinstance(geom_geojson, tuple) and len(geom_geojson) == 3:
        lon, lat, radius_m = geom_geojson
        return ee.Geometry.Point([lon, lat]).buffer(radius_m)
    raise ValueError(f"Geometría no soportada: {type(geom_geojson)!r}")
