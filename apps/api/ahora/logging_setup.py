"""structlog config — logs JSON-ish coloreados en dev, sirven como canal de notificación demo."""
from __future__ import annotations

import logging

import structlog

from ahora.config import settings


def setup_logging() -> None:
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(message)s",
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(colors=True),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level.upper()),
        ),
        cache_logger_on_first_use=True,
    )


log = structlog.get_logger()
