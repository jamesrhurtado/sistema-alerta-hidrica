"""Inicialización de Google Earth Engine. En MODO MOCK si no hay creds."""
from __future__ import annotations

import base64
import json
import threading
from pathlib import Path

from ahora.config import settings
from ahora.logging_setup import log

_initialized = False
_lock = threading.Lock()


def init_gee() -> bool:
    """Inicializa GEE. Retorna True si se autenticó, False si está en mock mode."""
    global _initialized
    with _lock:
        if _initialized:
            return not settings.gee_mock_mode

        if settings.gee_mock_mode:
            log.warning("gee.mock_mode_enabled", reason="missing_credentials")
            _initialized = True
            return False

        try:
            import ee  # type: ignore

            if settings.gee_service_account_json:
                key_path = Path(settings.gee_service_account_json).expanduser()
                with key_path.open() as fh:
                    sa = json.load(fh)
                credentials = ee.ServiceAccountCredentials(sa["client_email"], str(key_path))
            elif settings.gee_service_account_email and settings.gee_private_key_base64:
                key_data = base64.b64decode(settings.gee_private_key_base64)
                credentials = ee.ServiceAccountCredentials(
                    settings.gee_service_account_email,
                    key_data=key_data.decode(),
                )
            else:
                raise RuntimeError("No GEE credentials configured")

            ee.Initialize(credentials)
            log.info("gee.initialized")
            _initialized = True
            return True
        except Exception as exc:  # noqa: BLE001
            log.error("gee.init_failed", error=str(exc))
            _initialized = True
            return False


def is_mock() -> bool:
    return settings.gee_mock_mode
