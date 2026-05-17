"""Schemas pydantic compartidos entre routes y orchestrator."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "extreme"]


class Cuenca(BaseModel):
    id: str
    nombre: str
    foco: str | None = None
    lon: float
    lat: float
    zoom: int


class CaseStudy(BaseModel):
    id: str
    nombre: str
    cuenca_id: str | None = None
    lon: float
    lat: float
    zoom: int
    descripcion: str | None = None


class IvcParams(BaseModel):
    year_water_start: int = 1984
    year_water_end: int = 2021
    year_urb_start: int = 1990
    year_urb_end: int = 2020
    min_years_recurrente: int = 3      # umbral "agua recurrente"
    slope_max: float = 15.0
    buffer_m: int = 200
    built_threshold_m2: int = 500


class IvcSummary(BaseModel):
    cuenca_id: str
    params: IvcParams
    ivc_mean: float | None
    ivc_max: float | None
    pop_high_risk: int | None
    area_urb_inund_ha: float | None
    tile_url: str | None
    geotiff_url: str | None
    status: Literal["pending", "running", "ready", "error"]
    error: str | None = None
    mock: bool = False


class RainSample(BaseModel):
    cuenca_id: str
    fecha: date
    fuente: Literal["chirps", "gfs", "replay"]
    mm_24h_mean: float
    mm_24h_max: float | None = None


class AlertEvent(BaseModel):
    id: UUID
    cuenca_id: str
    severity: Severity
    message: str
    pop_estimated: int | None
    rain_mm_24h: float | None
    ivc_max: float | None
    created_at: datetime


class ReplayRequest(BaseModel):
    event: Literal[
        "rimac-2017-03-15",
        "piura-2017-03-27",
        "lima-2023-03-13",
    ] = Field(..., description="Evento histórico precableado")


class WorkflowStatus(BaseModel):
    run_id: UUID
    pipeline: str
    status: Literal["pending", "running", "success", "failed"]
    steps: list[dict[str, Any]]
    error: str | None = None
