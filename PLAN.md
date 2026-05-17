# Plan de AHORA — Hackatón Perú

> Sistema de Alerta Hídrica Oportuna con Respuesta Anticipada.
> Sistema de alerta temprana de inundaciones y huaicos para Perú,
> construido sobre el prototipo GEE `AGUA & ASFALTO v3.0`.

## Contexto

Cada año, las inundaciones y huaicos son las catástrofes que más personas desplazan en Perú. Ciclón Yaku (marzo 2023): 99 muertes, 370.000 afectados, ~24.400 viviendas colapsadas. El Niño Costero (2017): >40 muertes en Piura, 200.000+ damnificados. La causa raíz no es solo climática: es la **falta de alerta temprana accionable** combinada con expansión urbana sobre cauces y quebradas.

**AHORA** combina geointeligencia (Google Earth Engine) + pronóstico meteorológico + pipeline durable de alertas multicanal para anticipar 12–24 h y notificar a comunidades y autoridades.

**Base existente reutilizada:** el script GEE `AGUA & ASFALTO v3.0` (Code Editor JS, `tools/agua-asfalto-v3.js`) ya implementaba el Índice de Vulnerabilidad Compuesto (IVC), las paletas, los casos emblemáticos y el análisis Sentinel-1. AHORA es la evolución productizada: lo desacoplamos del Code Editor, lo orquestamos detrás de una API, y le añadimos pronóstico + pipeline de alerta + dashboard público interactivo.

---

## Decisiones del MVP

| Decisión | Por qué |
|---|---|
| **Hackatón 48–72 h** | Demo end-to-end con storytelling, no producción. |
| **Cuenca única: Rímac (foco Chosica)** | Caso emblemático de huaicos recurrentes (1987, 2017, 2023). Datos GEE bien cubiertos. Profundidad sobre amplitud. |
| **Local-first** | Todo corre en la Mac del desarrollador. Despliegue a Azure/Vercel queda para una fase posterior. |
| **Mock fallback para GEE** | Si no hay credenciales, el backend produce datos sintéticos determinísticos para iterar el frontend sin red. |
| **Simulador SMS (no Twilio)** | Tabla `sms_outbox` + panel SSE. Mismo impacto visual; adaptador permite swap a Twilio o Azure Communication Services sin refactor. |
| **Step runner sobre Postgres** | Equivalente local de Azure Durable Functions. Cada step persiste estado, soporta retries y resume. |

## Stack final (lo que corre hoy)

| Capa | Tecnología | Puerto |
|---|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind v4 + MapLibre GL | `:3000` |
| Backend | FastAPI (Python 3.12 vía pyenv) + earthengine-api | `:8000` |
| Base de datos | Postgres 16 + PostGIS (Docker) | `:5433` |
| Orquestación | Step runner casero sobre Postgres (en `ahora/orchestrator/`) | — |
| Mapas raster | Tiles XYZ dinámicos servidos por GEE (`ee.Image.getMapId()`) | — |
| Notificaciones | Stdout del servidor + tabla `sms_outbox` con SSE en `/admin/outbox` | — |

## Lo que reutilizamos del prototipo GEE

| Elemento original | Reuso en AHORA |
|---|---|
| Fórmula IVC (0.30 agua + 0.20 pendiente + 0.20 buffer + 0.15 built + 0.15 pop) | **Idéntica**, portada a `apps/api/ahora/gee/layers.py` |
| Datasets (JRC GSW, GHSL Built-S/Pop, SRTM, HydroSHEDS, CHIRPS, S1, ESA) | **Idénticos** (mismas IDs en `ee.ImageCollection(...)`) |
| Casos emblemáticos (Chosica, Catacaos, Punta Hermosa, etc.) | Seedeados en tabla `case_study` |
| Paletas (`PAL.aguaFreq`, `PAL.urbanoTemporal`, `PAL.ivc`...) | En `gee/layers.py:PALETTES` |
| Parámetros (umbral años, m² construido, pendiente, buffer m) | En `models.py:IvcParams` |
| Lógica buffer (`fastDistanceTransform`) y polígonos de riesgo | Idéntica |
| Lista eventos ENSO | Seedeada en `enso_event` |

## Lo que AHORA añade

1. **Backend desacoplado**: el cálculo geoespacial vive en un API HTTP, no en un Code Editor.
2. **Replay histórico programable**: 3 eventos precableados (Rímac 2017-03-15, Piura 2017-03-27, Lima 2023-03-13) que disparan la cadena completa.
3. **Pipeline durable**: orchestrator con steps reintentables y persistencia en Postgres.
4. **Simulador de notificaciones**: tabla `sms_outbox` + panel SSE en vivo.
5. **Dashboard público interactivo**: Next.js con mapa MapLibre + 8 capas GEE alternables + leyenda dinámica + panel de stats.
6. **Cache de cómputo pesado**: tabla `ivc_run` y cache in-memory para `/layers`.

## Plan de fases (ejecutadas)

| Fase | Estado | Entregable |
|---|---|---|
| F0 — Bootstrap | ✅ | Repo monorepo, Postgres docker, .env, pyenv 3.12, GEE service account. |
| F1 — Backend FastAPI + IVC | ✅ | `GET /ivc/{cuenca}` devuelve IVC mean/max/pop. |
| F2 — Replay histórico | ✅ | `POST /replay` ejecuta pipeline durable con 3 eventos. |
| F3 — Notificaciones simuladas | ✅ | Tabla `sms_outbox`, stdout, SSE en `/admin/outbox`. |
| F4 — Frontend Next.js | ✅ | 5 páginas (home, cuenca, replay, alertas, outbox). |
| F5 — Capas dinámicas | ✅ | `GET /layers/{cuenca}` con 8 capas GEE + toggles + leyenda. |
| F6 — GEE en vivo | ✅ | Service account real conectado, IVC computado contra GEE. |

## Pendientes (post-hackatón)

| Pendiente | Cómo se haría |
|---|---|
| Despliegue Azure (backend) + Vercel (web) | Funcs Python para FastAPI → Azure Container Apps; web → Vercel. |
| Cron diario | GitHub Actions `schedule: 0 11 * * *` que llama `/replay/monitor`. |
| Twilio / Azure Communication Services real | Cambiar adaptador `SmsProvider` (la interfaz está prevista). |
| Pronóstico GFS real activado | Llamar `NOAA/GFS0P25` desde `gee/precipitation.py:get_gfs_forecast` (ya implementado, falta integrarlo en el cron). |
| Modelo ML para refinar umbral | XGBoost o LSTM por cuenca con históricos SENAMHI. |
| Validación post-evento con Sentinel-1 | Función `detectarInundacionS1()` del prototipo lista para portar (umbral VH < -17 dB). |
| Animación temporal (frame por año GHSL) | `ee.Thumbnail` API. Visualmente impactante para la demo. |
| Pilotaje real con SENAMHI / INDECI | Coordinación institucional, fuera de scope técnico. |

## Métricas de éxito (reales sobre Chosica)

Calculadas en vivo por GEE sobre 15 km de buffer alrededor de Chosica:

- **Expansión urbana** 1990→2020: 362.8 ha
- **De eso, en zona inundable**: 34.8 ha (9.6%)
- **Urbano antiguo (pre-1990) en zona de agua**: 224.6 ha
- **Población en riesgo alto (IVC > 60)**: 502 hab (estimación conservadora GHSL)
- **Población total expuesta**: 12,285 hab
- **IVC promedio (zona urbana)**: 53.6 / 100
- **IVC máximo**: 76.6 (píxel más crítico)

Estos números coinciden 1:1 con los reportados por el prototipo en el Code Editor, confirmando que el port a Python es correcto.

## Estructura del repo

Ver [README.md](README.md) para arranque rápido y [ARCHITECTURE.md](ARCHITECTURE.md) para detalles técnicos.
