"""Configuración cargada desde .env (pydantic-settings)."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Base de datos
    database_url: str = "postgresql+asyncpg://ahora:ahora@localhost:5433/ahora"

    # GEE
    gee_service_account_json: str = ""
    gee_service_account_email: str = ""
    gee_private_key_base64: str = ""

    # Storage local
    local_storage_dir: Path = Path("./storage")
    public_tiles_base_url: str = "http://localhost:8000/tiles"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Kapso WhatsApp
    kapso_api_key: str = ""
    kapso_base_url: str = "https://api.kapso.ai/platform/v1"
    kapso_phone_number_id: str = ""
    kapso_template_id: str = ""
    kapso_webhook_secret: str = ""

    # Monitor automático
    monitor_interval_minutes: int = 60

    # Logging
    log_level: str = "INFO"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def gee_mock_mode(self) -> bool:
        """True si no hay credenciales GEE → backend devuelve datos sintéticos."""
        return not (self.gee_service_account_json or self.gee_service_account_email)


settings = Settings()
settings.local_storage_dir.mkdir(parents=True, exist_ok=True)
(settings.local_storage_dir / "tiles").mkdir(parents=True, exist_ok=True)
(settings.local_storage_dir / "cog").mkdir(parents=True, exist_ok=True)
