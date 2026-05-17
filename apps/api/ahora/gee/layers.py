"""Capas geoespaciales completas para visualización dinámica en MapLibre.

Port del análisis principal del prototipo `AGUA & ASFALTO v3.0` (función
`actualizar()` del Code Editor). Devuelve `ee.Image` por cada capa y stats
agregados; un segundo paso convierte cada imagen a URL `{z}/{x}/{y}` vía
`ee.Image.getMapId()` para que MapLibre la consuma directamente.
"""
from __future__ import annotations

import hashlib
import json
import random
import time
from typing import Any

from ahora.gee.auth import init_gee, is_mock
from ahora.logging_setup import log
from ahora.models import IvcParams

GHSL_YEARS = [1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2030]

PALETTES = {
    "agua_freq":       ["#f7fbff", "#deebf7", "#9ecae1", "#4292c6", "#08519c", "#08306b"],
    "agua_max":        ["#c6dbef", "#9ecae1"],
    "agua_recurrente": ["#08306b"],
    "urbano_temporal": ["#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014",
                        "#cc4c02", "#993404", "#662506"],
    "urb_nuevo":       ["#cc4c02"],
    "ivc":             ["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027", "#a50026"],
    "riesgo_nuevo":    ["#ff0066"],
    "riesgo_antiguo":  ["#fdae6b"],
    "pendiente":       ["#1a9850", "#fee08b", "#d73027"],
    "poblacion":       ["#ffffcc", "#fd8d3c", "#bd0026", "#67000d"],
}


def stack_hash(cuenca_id: str, params: IvcParams) -> str:
    raw = json.dumps({"c": cuenca_id, **params.model_dump()}, sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


# ─────────────────────────────────────────────────────────
# Mock mode (sin credenciales GEE)
# ─────────────────────────────────────────────────────────
def _mock_stack(cuenca_id: str, params: IvcParams) -> dict[str, Any]:
    rnd = random.Random(f"{cuenca_id}:{stack_hash(cuenca_id, params)}")
    return {
        "layers": {},
        "stats": {
            "ivc_mean": round(rnd.uniform(40, 60), 2),
            "ivc_max": round(rnd.uniform(70, 90), 2),
            "pop_high_risk": rnd.randint(400, 600),
            "pop_total_expuesta": rnd.randint(8000, 15000),
            "area_urb_total_ha": round(rnd.uniform(2500, 3500), 1),
            "area_urb_expansion_ha": round(rnd.uniform(300, 450), 1),
            "area_urb_inund_ha": round(rnd.uniform(20, 40), 1),
            "area_urb_inund_antiguo_ha": round(rnd.uniform(150, 300), 1),
            "pct_expansion_inund": round(rnd.uniform(7, 12), 1),
        },
        "year_water_start": params.year_water_start,
        "year_water_end": params.year_water_end,
        "year_urb_start": params.year_urb_start,
        "year_urb_end": params.year_urb_end,
        "total_years": params.year_water_end - params.year_water_start + 1,
        "mock": True,
    }


# ─────────────────────────────────────────────────────────
# Core: compute layers + stats
# ─────────────────────────────────────────────────────────
def build_layer_stack(
    cuenca_id: str,
    geom_lon_lat_radius: tuple[float, float, float],
    params: IvcParams,
) -> dict[str, Any]:
    """Computa todas las capas + stats agregados. Cae a mock si no hay GEE."""
    init_gee()
    if is_mock():
        return _mock_stack(cuenca_id, params)

    import ee  # type: ignore

    t0 = time.time()
    lon, lat, radius = geom_lon_lat_radius
    aoi = ee.Geometry.Point([lon, lat]).buffer(radius)

    yWs = params.year_water_start
    yWe = params.year_water_end
    yUs = params.year_urb_start
    yUe = params.year_urb_end
    thr = params.built_threshold_m2
    minY = params.min_years_recurrente
    slpMax = params.slope_max
    bufDist = params.buffer_m
    total_years = yWe - yWs + 1

    # Datasets
    gswYearly = ee.ImageCollection("JRC/GSW1_4/YearlyHistory")
    gswAll = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    ghsl = ee.ImageCollection("JRC/GHSL/P2023A/GHS_BUILT_S")
    ghslPop = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP")
    dem = ee.Image("USGS/SRTMGL1_003")
    slope = ee.Terrain.slope(dem)

    # ── AGUA ──
    aguaFreqRaw = (
        gswYearly.filter(ee.Filter.calendarRange(yWs, yWe, "year"))
        .map(lambda img: img.select("waterClass").gte(2).rename("w"))
        .sum()
        .clip(aoi)
    )
    aguaFreq = aguaFreqRaw.updateMask(aguaFreqRaw.gte(1))
    aguaRecurrente = aguaFreqRaw.gte(minY)
    aguaMaxExt = gswAll.select("max_extent").clip(aoi)

    # Buffer de proximidad
    aguaBase = aguaRecurrente.unmask(0)
    dist = (
        aguaBase.fastDistanceTransform(256)
        .sqrt()
        .multiply(ee.Image.pixelArea().sqrt())
    )
    bufferAgua = dist.lte(bufDist).clip(aoi)

    # ── URBANO TEMPORAL (año de primera aparición) ──
    years_in_range = [y for y in GHSL_YEARS if yUs <= y <= yUe]
    imgs = []
    for y in years_in_range:
        built = (
            ghsl.filter(ee.Filter.calendarRange(y, y, "year"))
            .first()
            .select("built_surface")
            .gte(thr)
        )
        imgs.append(
            built.multiply(ee.Image.constant(y))
            .updateMask(built)
            .rename("year_built")
            .toInt()
        )
    urbanoTemporal = ee.ImageCollection(imgs).min().clip(aoi).rename("year_built")

    ghslA = (
        ghsl.filter(ee.Filter.calendarRange(yUs, yUs, "year"))
        .first()
        .select("built_surface")
        .clip(aoi)
    )
    ghslB = (
        ghsl.filter(ee.Filter.calendarRange(yUe, yUe, "year"))
        .first()
        .select("built_surface")
        .clip(aoi)
    )
    urbAntes = ghslA.gte(thr)
    urbDespues = ghslB.gte(thr)
    urbNuevo = urbDespues.And(urbAntes.Not())

    slopeMask = slope.lte(slpMax)

    riesgoNuevo = urbNuevo.And(bufferAgua).And(slopeMask)
    riesgoAntiguo = urbAntes.And(bufferAgua).And(slopeMask)

    # ── Población ──
    popImg = (
        ghslPop.filter(ee.Filter.calendarRange(yUe, yUe, "year"))
        .first()
        .select("population_count")
        .clip(aoi)
    )

    # ── IVC (fórmula canónica del prototipo) ──
    nAgua = aguaFreqRaw.divide(total_years)
    nSlope = ee.Image(1).subtract(slope.divide(30).clamp(0, 1))
    nBuffer = bufferAgua.toFloat()
    nBuilt = ghslB.divide(5000).clamp(0, 1)
    nPop = popImg.unmask(0).divide(50).clamp(0, 1)
    ivc = (
        nAgua.multiply(0.30)
        .add(nSlope.multiply(0.20))
        .add(nBuffer.multiply(0.20))
        .add(nBuilt.multiply(0.15))
        .add(nPop.multiply(0.15))
        .multiply(100)
        .clip(aoi)
        .rename("ivc")
    )

    # ── Stats (1 sola llamada combinada para minimizar latencia) ──
    pxArea = ee.Image.pixelArea()
    stackSum = (
        riesgoNuevo.multiply(pxArea).rename("area_rNuevo")
        .addBands(riesgoAntiguo.multiply(pxArea).rename("area_rAntiguo"))
        .addBands(urbDespues.multiply(pxArea).rename("area_urb"))
        .addBands(urbNuevo.multiply(pxArea).rename("area_exp"))
        .addBands(popImg.updateMask(riesgoNuevo).rename("pop_rNuevo"))
        .addBands(popImg.updateMask(riesgoNuevo.Or(riesgoAntiguo)).rename("pop_total"))
    )
    sums = stackSum.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=aoi, scale=100, maxPixels=int(1e13), bestEffort=True,
    ).getInfo()

    ivc_stats = (
        ivc.updateMask(urbDespues)
        .reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True),
            geometry=aoi, scale=100, maxPixels=int(1e13), bestEffort=True,
        )
        .getInfo()
    )

    area_exp_ha = (sums.get("area_exp") or 0) / 10000
    area_rN_ha = (sums.get("area_rNuevo") or 0) / 10000

    stats = {
        "area_urb_total_ha": round((sums.get("area_urb") or 0) / 10000, 1),
        "area_urb_expansion_ha": round(area_exp_ha, 1),
        "area_urb_inund_ha": round(area_rN_ha, 1),
        "area_urb_inund_antiguo_ha": round((sums.get("area_rAntiguo") or 0) / 10000, 1),
        "pop_high_risk": int(sums.get("pop_rNuevo") or 0),
        "pop_total_expuesta": int(sums.get("pop_total") or 0),
        "ivc_mean": round(ivc_stats.get("ivc_mean") or 0, 2),
        "ivc_max": round(ivc_stats.get("ivc_max") or 0, 2),
        "pct_expansion_inund": round(
            (area_rN_ha / area_exp_ha * 100) if area_exp_ha > 0 else 0, 1
        ),
    }

    # ── Generar tile URLs (lo más lento: getMapId requiere prepare en GEE) ──
    layers = _images_to_tile_layers(
        {
            "agua_max": aguaMaxExt.updateMask(aguaMaxExt),
            "agua_freq": aguaFreq,
            "agua_recurrente": aguaRecurrente.selfMask(),
            "urbano_temporal": urbanoTemporal,
            "urb_nuevo": urbNuevo.selfMask(),
            "ivc": ivc.updateMask(ivc.gt(15)),
            "riesgo_antiguo": riesgoAntiguo.selfMask(),
            "riesgo_nuevo": riesgoNuevo.selfMask(),
        },
        yUs=yUs, yUe=yUe, total_years=total_years,
    )

    dt = round(time.time() - t0, 2)
    log.info("gee.layer_stack_built", cuenca=cuenca_id, seconds=dt, n_layers=len(layers))

    return {
        "layers": layers,
        "stats": stats,
        "year_water_start": yWs,
        "year_water_end": yWe,
        "year_urb_start": yUs,
        "year_urb_end": yUe,
        "total_years": total_years,
        "build_seconds": dt,
        "mock": False,
    }


def _images_to_tile_layers(
    images: dict[str, Any],
    yUs: int,
    yUe: int,
    total_years: int,
) -> dict[str, dict[str, Any]]:
    """Convierte cada ee.Image en una capa MapLibre (raster XYZ)."""
    # Definición de viz por capa
    viz: dict[str, dict[str, Any]] = {
        "agua_max": {
            "label": "💧 Extensión máx. histórica",
            "palette": PALETTES["agua_max"],
            "opacity": 0.45,
            "default_visible": True,
        },
        "agua_freq": {
            "label": "🌊 Intensidad agua (años)",
            "min": 1,
            "max": max(2, int(total_years * 0.6)),
            "palette": PALETTES["agua_freq"],
            "opacity": 0.85,
            "default_visible": True,
        },
        "agua_recurrente": {
            "label": "💠 Agua recurrente",
            "palette": PALETTES["agua_recurrente"],
            "opacity": 0.9,
            "default_visible": False,
        },
        "urbano_temporal": {
            "label": f"🏗️ Año aparición urbana ({yUs}→{yUe})",
            "min": yUs,
            "max": yUe,
            "palette": PALETTES["urbano_temporal"],
            "opacity": 0.85,
            "default_visible": True,
        },
        "urb_nuevo": {
            "label": f"🆕 Expansión {yUs}→{yUe}",
            "palette": PALETTES["urb_nuevo"],
            "opacity": 0.7,
            "default_visible": False,
        },
        "ivc": {
            "label": "🎯 IVC (semáforo)",
            "min": 15,
            "max": 80,
            "palette": PALETTES["ivc"],
            "opacity": 0.7,
            "default_visible": False,
        },
        "riesgo_antiguo": {
            "label": "⚠️ Riesgo medio (antiguo)",
            "palette": PALETTES["riesgo_antiguo"],
            "opacity": 0.65,
            "default_visible": True,
        },
        "riesgo_nuevo": {
            "label": "🚨 Riesgo ALTO (nuevo)",
            "palette": PALETTES["riesgo_nuevo"],
            "opacity": 0.85,
            "default_visible": True,
        },
    }

    out: dict[str, dict[str, Any]] = {}
    for key, image in images.items():
        cfg = viz.get(key)
        if not cfg:
            continue
        vis_params: dict[str, Any] = {"palette": cfg["palette"]}
        if "min" in cfg:
            vis_params["min"] = cfg["min"]
        if "max" in cfg:
            vis_params["max"] = cfg["max"]
        mapid = image.getMapId(vis_params)
        out[key] = {
            "id": key,
            "label": cfg["label"],
            "tile_url": mapid["tile_fetcher"].url_format,
            "palette": cfg["palette"],
            "min": cfg.get("min"),
            "max": cfg.get("max"),
            "opacity": cfg["opacity"],
            "default_visible": cfg["default_visible"],
        }
    return out
