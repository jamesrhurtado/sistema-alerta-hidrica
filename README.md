# AHORA — Sistema de Alerta Hídrica Oportuna con Respuesta Anticipada

Sistema de alerta temprana de inundaciones y huaicos para Perú. Combina
geointeligencia satelital (Google Earth Engine) con pronósticos meteorológicos
para anticipar eventos extremos y notificar a comunidades y autoridades.

**Estado:** prototipo funcional en local (cuenca piloto Rímac/Chosica).
Construido sobre el script GEE Code Editor `AGUA & ASFALTO v3.0`
(en `tools/agua-asfalto-v3.js`, usado como herramienta de calibración interna).

---

## Arquitectura local

```
┌────────────────────┐   HTTP    ┌─────────────────────────┐   ee.api    ┌──────────────────┐
│  Next.js 16 :3000  │ ────────> │  FastAPI :8000          │ ──────────> │ Google Earth     │
│  (App Router,      │           │  - GEE wrappers          │   (mock     │ Engine           │
│   MapLibre)        │ <──────── │  - Step runner Postgres  │    si no    └──────────────────┘
└────────────────────┘   JSON    │  - SSE alertas           │    hay creds)
                                 └────────────┬─────────────┘
                                              │ asyncpg
                                              ▼
                                 ┌─────────────────────────┐
                                 │  Postgres 16 + PostGIS  │
                                 │  Docker :5433           │
                                 └─────────────────────────┘
```

## Requisitos

- **Docker Desktop** (Postgres + PostGIS)
- **Node 20+** y **pnpm 11+** (frontend)
- **Python 3.12** (pyenv lo gestiona automáticamente)
- *(Opcional)* JSON de service account de Google Earth Engine.
  **Sin credenciales el backend corre en MODO MOCK** y produce IVC sintético determinístico.

## Arranque rápido (3 terminales)

```bash
# Terminal 1 — base de datos
pnpm db:up           # docker compose up -d db
# verifica:
pnpm db:psql         # entra con psql al container

# Terminal 2 — backend FastAPI
pnpm api:install     # crea venv con pyenv 3.12 + instala deps
pnpm api:dev         # uvicorn con reload en :8000

# Terminal 3 — frontend Next.js
pnpm dev             # next dev (turbopack) en :3000
```

Abrí <http://localhost:3000> para ver el dashboard.
Documentación interactiva del API en <http://localhost:8000/docs>.

## Demo end-to-end

1. Ir a <http://localhost:3000/replay>
2. Presionar **Disparar replay** en `rimac-2017-03-15`
   (huaico Carretera Central, quebrada Pedregal Chico).
3. El backend ejecuta el pipeline durable:
   `load-event → load-cuenca → inject-rain → load-ivc → persist-event → notify-console`.
4. En <http://localhost:3000/alertas> aparece la alerta con severidad **EXTREMA**.
5. En <http://localhost:3000/admin/outbox> aparecen los 4 SMS simulados
   (3 residentes + 1 autoridad de Defensa Civil) con el texto exacto que llegaría.
6. La consola del backend imprime el SMS en stdout
   (canal de notificación demo).

## Estructura

```
ai-hack-v2/
├── apps/
│   ├── api/                    # FastAPI + step runner (Python 3.12)
│   │   ├── ahora/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── db.py
│   │   │   ├── models.py
│   │   │   ├── gee/            # auth, ivc (port del prototipo), precipitation
│   │   │   ├── orchestrator/   # runner + pipelines (monitor, replay)
│   │   │   └── routers/        # health, cuencas, ivc, replay, alerts
│   │   ├── db/                 # schema.sql + seeds (autoload en docker)
│   │   ├── scripts/            # install.sh, dev.sh
│   │   ├── pyproject.toml
│   │   └── .env.example
│   └── web/                    # Next.js 16 (App Router)
│       ├── app/
│       │   ├── page.tsx                  # mapa nacional + KPIs
│       │   ├── cuenca/[slug]/page.tsx
│       │   ├── replay/page.tsx
│       │   ├── alertas/page.tsx
│       │   └── admin/outbox/page.tsx
│       ├── components/         # RiskMap (MapLibre), KPICard, OutboxLive...
│       └── lib/                # api client, utils
├── tools/
│   └── agua-asfalto-v3.js      # script GEE original (calibración)
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json                # scripts del workspace
```

## Conectar Google Earth Engine real

Por defecto el backend está en **modo mock**: `compute_ivc()` devuelve valores
sintéticos pero estables. Para activar GEE real:

1. Obtené un service account JSON con acceso a Earth Engine.
2. Ponelo en `apps/api/secrets/gee-sa.json` (la carpeta está en `.gitignore`).
3. Editá `apps/api/.env`:
   ```
   GEE_SERVICE_ACCOUNT_JSON=./secrets/gee-sa.json
   ```
4. Reiniciá el dev server: el log debería decir `gee.initialized` (en vez de
   `gee.mock_mode_enabled`).
5. Borrá la caché de IVC: `pnpm db:psql -c 'DELETE FROM ivc_run;'`
   para que las próximas llamadas usen GEE real.

## Comandos útiles

```bash
pnpm db:up              # levantar Postgres
pnpm db:down            # apagarlo
pnpm db:reset           # destruir volumen y volver a sembrar
pnpm db:psql            # consola psql al container
pnpm db:logs            # ver logs de Postgres

pnpm api:install        # crear venv y instalar deps Python
pnpm api:dev            # correr uvicorn con reload

pnpm dev                # correr Next.js
pnpm build              # build de producción del frontend
```

## API endpoints clave

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado DB + GEE |
| GET | `/cuencas` | Lista de cuencas piloto |
| GET | `/cuencas/{id}` | Detalle de una cuenca (incluye AOI GeoJSON) |
| GET | `/cuencas/{id}/case-studies` | Casos emblemáticos asociados |
| GET | `/ivc/{cuenca_id}` | Resumen IVC (cacheado en Postgres) |
| GET | `/replay/events` | Eventos históricos disponibles |
| POST | `/replay` | Body `{"event": "rimac-2017-03-15"}` — dispara pipeline |
| POST | `/replay/monitor?cuenca_id=rimac` | Pipeline diario manual |
| GET | `/alerts` | Histórico de alertas |
| GET | `/alerts/outbox` | SMS encolados |
| GET | `/alerts/stream` | SSE feed de alertas nuevas |

## Documentación adicional

- **[PLAN.md](PLAN.md)** — Plan que seguimos, decisiones, lo hecho vs lo pendiente.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Cómo funciona todo: datos, fórmulas, flujo de un request.
- **[GUIA.md](GUIA.md)** — Guía de usuario: qué hace cada página, cada botón, demo paso a paso.
