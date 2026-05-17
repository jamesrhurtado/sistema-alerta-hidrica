"""Step runner local: persiste cada paso en Postgres con retries y checkpoint.

Pensado como equivalente mínimo de Azure Durable Functions para correr en local.
Cada `step()` se ejecuta solo si no fue marcado `success` previamente, lo que
permite reiniciar un run y continuar donde quedó.
"""
from __future__ import annotations

import asyncio
import inspect
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text

from ahora.db import get_session
from ahora.logging_setup import log

StepFn = Callable[[dict[str, Any]], Awaitable[Any]] | Callable[[dict[str, Any]], Any]


@dataclass
class StepSpec:
    name: str
    fn: StepFn
    retries: int = 3
    backoff_seconds: float = 1.5


@dataclass
class Pipeline:
    name: str
    steps: list[StepSpec] = field(default_factory=list)

    def step(self, name: str, retries: int = 3, backoff_seconds: float = 1.5):
        def decorator(fn: StepFn) -> StepFn:
            self.steps.append(StepSpec(name=name, fn=fn, retries=retries, backoff_seconds=backoff_seconds))
            return fn
        return decorator


async def start_run(pipeline_name: str, payload: dict[str, Any]) -> UUID:
    """Crea un workflow_run y devuelve su id."""
    async with get_session() as s:
        res = await s.execute(
            text(
                "INSERT INTO workflow_run (pipeline, payload, status) "
                "VALUES (:p, CAST(:pl AS JSONB), 'pending') RETURNING id"
            ),
            {"p": pipeline_name, "pl": json.dumps(payload)},
        )
        run_id = res.scalar_one()
        await s.commit()
    return run_id


async def execute(pipeline: Pipeline, run_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
    """Ejecuta el pipeline. Cada step persiste su estado; falla → marca run failed."""
    context: dict[str, Any] = {"payload": payload, "run_id": str(run_id)}

    async with get_session() as s:
        await s.execute(
            text(
                "UPDATE workflow_run SET status='running', started_at=now() WHERE id=:rid"
            ),
            {"rid": run_id},
        )
        await s.commit()

    for idx, step in enumerate(pipeline.steps):
        if await _step_already_succeeded(run_id, step.name):
            log.info("step.skipped_replay", step=step.name)
            continue

        result = await _run_step(run_id, idx, step, context)
        if result["status"] == "failed":
            async with get_session() as s:
                await s.execute(
                    text(
                        "UPDATE workflow_run SET status='failed', finished_at=now(), "
                        "error=:err WHERE id=:rid"
                    ),
                    {"rid": run_id, "err": result["error"]},
                )
                await s.commit()
            return {"status": "failed", "run_id": str(run_id), "step": step.name, "error": result["error"]}

        # exponer outputs como context[step.name]
        context[step.name] = result["output"]

    async with get_session() as s:
        await s.execute(
            text("UPDATE workflow_run SET status='success', finished_at=now() WHERE id=:rid"),
            {"rid": run_id},
        )
        await s.commit()

    return {"status": "success", "run_id": str(run_id), "context": context}


async def _step_already_succeeded(run_id: UUID, step_name: str) -> bool:
    async with get_session() as s:
        res = await s.execute(
            text(
                "SELECT status FROM workflow_step WHERE run_id=:rid AND step_name=:n"
            ),
            {"rid": run_id, "n": step_name},
        )
        row = res.first()
        return bool(row and row[0] == "success")


async def _run_step(
    run_id: UUID, idx: int, step: StepSpec, context: dict[str, Any]
) -> dict[str, Any]:
    attempt = 0
    last_err: str | None = None
    while attempt <= step.retries:
        async with get_session() as s:
            await s.execute(
                text(
                    "INSERT INTO workflow_step (run_id, step_name, idx, attempt, status, started_at) "
                    "VALUES (:rid, :n, :i, :att, 'running', now()) "
                    "ON CONFLICT (run_id, step_name) DO UPDATE SET "
                    "  attempt=:att, status='running', started_at=now()"
                ),
                {"rid": run_id, "n": step.name, "i": idx, "att": attempt},
            )
            await s.commit()

        try:
            log.info("step.start", step=step.name, attempt=attempt)
            result = step.fn(context)
            if inspect.isawaitable(result):
                result = await result

            async with get_session() as s:
                await s.execute(
                    text(
                        "UPDATE workflow_step SET status='success', output=CAST(:o AS JSONB), "
                        "finished_at=now(), error=NULL WHERE run_id=:rid AND step_name=:n"
                    ),
                    {"rid": run_id, "n": step.name, "o": json.dumps(_jsonify(result))},
                )
                await s.commit()

            log.info("step.success", step=step.name)
            return {"status": "success", "output": result}

        except Exception as exc:  # noqa: BLE001
            last_err = f"{type(exc).__name__}: {exc}"
            log.error("step.failed", step=step.name, attempt=attempt, error=last_err)

            async with get_session() as s:
                await s.execute(
                    text(
                        "UPDATE workflow_step SET status='failed', error=:e, finished_at=now() "
                        "WHERE run_id=:rid AND step_name=:n"
                    ),
                    {"rid": run_id, "n": step.name, "e": last_err},
                )
                await s.commit()

            attempt += 1
            if attempt <= step.retries:
                await asyncio.sleep(step.backoff_seconds * (2 ** (attempt - 1)))

    return {"status": "failed", "error": last_err}


def _jsonify(v: Any) -> Any:
    """Convierte tipos no-JSON (datetime, UUID, Decimal) a strings."""
    if isinstance(v, (datetime,)):
        return v.astimezone(UTC).isoformat()
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, dict):
        return {k: _jsonify(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonify(x) for x in v]
    return v
