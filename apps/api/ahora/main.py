"""FastAPI app — punto de entrada del backend AHORA."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ahora.config import settings
from ahora.gee.auth import init_gee
from ahora.logging_setup import log, setup_logging
from ahora.routers import alerts, cuencas, health, ivc, layers, replay


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log.info("ahora.boot", mock_mode=settings.gee_mock_mode)
    init_gee()
    yield


app = FastAPI(
    title="AHORA — backend",
    description="Sistema de Alerta Hídrica Oportuna con Respuesta Anticipada",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(cuencas.router)
app.include_router(ivc.router)
app.include_router(layers.router)
app.include_router(replay.router)
app.include_router(alerts.router)

# Servir tiles/COGs generados desde storage local
tiles_dir = Path(settings.local_storage_dir) / "tiles"
tiles_dir.mkdir(parents=True, exist_ok=True)
app.mount("/tiles", StaticFiles(directory=str(tiles_dir)), name="tiles")


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "ahora-api",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }
