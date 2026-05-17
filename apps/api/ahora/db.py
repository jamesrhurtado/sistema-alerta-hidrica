"""Cliente asyncpg / SQLAlchemy async."""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ahora.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """Context manager para usar dentro de orchestrator / activities."""
    async with SessionLocal() as session:
        yield session


async def fastapi_session() -> AsyncIterator[AsyncSession]:
    """Dependency injectable en routes FastAPI."""
    async with SessionLocal() as session:
        yield session
