# Arquitectura — AHORA

Esta guía explica cómo encaja todo, de dónde viene cada dato y qué hace cada componente. Pensada para que cualquiera (jurado, contribuyente nuevo) entienda el sistema en 5 minutos.

---

## Visión general

```
                ┌─────────────────────────────────────┐
                │   Google Earth Engine               │
                │   (datasets globales + cómputo)     │
                │   JRC · GHSL · CHIRPS · SRTM · S1   │
                └────────────────┬────────────────────┘
                                 │ earthengine-api (Python)
                                 ▼
   ┌─────────────────────────────────────────────────┐
   │   Backend FastAPI :8000                          │
   │   - Calcula IVC + capas con la fórmula del       │
   │     prototipo AGUA & ASFALTO v3                  │
   │   - Step runner durable sobre Postgres            │
   │   - Sirve tiles XYZ + JSON                        │
   └─────────────────────────┬───────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Postgres +   │  │ Stdout       │  │ MapLibre tile│
   │ PostGIS :5433│  │ (canal demo) │  │ XYZ de GEE   │
   │ - cuencas    │  │   📱 SMS...  │  │ dinámicas    │
   │ - alertas    │  └──────────────┘  └──────┬───────┘
   │ - outbox     │                            │
   │ - workflows  │                            │
   └──────┬───────┘                            │
          │ asyncpg                            │
          │                                    │
   ┌──────▼────────────────────────────────────▼──────┐
   │  Frontend Next.js 16 :3000                        │
   │  - Mapa interactivo con 8 capas alternables      │
   │  - Panel "Resumen del análisis"                  │
   │  - Bandeja SMS en vivo (SSE)                     │
   │  - Triggers de replay histórico                  │
   └───────────────────────────────────────────────────┘
```

---

## ¿De dónde viene la data?

Toda la geoinformación viene de **Google Earth Engine**, una plataforma de Google que aloja y permite procesar más de 90 PB de imágenes satelitales y rásters globales. AHORA usa estos datasets:

| Dataset (en GEE) | Para qué lo usamos | Frecuencia / resolución |
|---|---|---|
| `UCSB-CHG/CHIRPS/DAILY` | Lluvia satelital diaria histórica (1981→) | diaria, ~5 km |
| `NOAA/GFS0P25` | Pronóstico meteorológico 0–384 h | 6h, 25 km |
| `JRC/GSW1_4/YearlyHistory` | Para cada año, dónde hubo agua. Base del componente "agua histórica" del IVC | anual 1984–2021, 30 m |
| `JRC/GSW1_4/GlobalSurfaceWater` | Extensión máxima histórica del agua (mapa de la sombra azul) | estático, 30 m |
| `USGS/SRTMGL1_003` | Modelo digital de elevación → pendiente | estático, 30 m |
| `JRC/GHSL/P2023A/GHS_BUILT_S` | Superficie construida en m² por píxel, por año | quinquenal 1975–2030, 100 m |
| `JRC/GHSL/P2023A/GHS_POP` | Población estimada por píxel | quinquenal, 100 m |
| `WWF/HydroSHEDS/v1/FreeFlowingRivers` | Red hidrográfica (ríos y quebradas) | estático, vector |
| `COPERNICUS/S1_GRD` | Radar Sentinel-1 (detección de inundación post-evento) | semanal, 10 m |
| `ESA/WorldCover/v200` | Cobertura del suelo 2021 | estático, 10 m |
| `FAO/GAUL/2015/level0..2` | Límites administrativos Perú | estático, vector |

**Nada se descarga al servidor local.** Cuando el backend pide IVC para Chosica, le manda una "receta" a GEE (un grafo computacional) y GEE devuelve:
- Reducciones (números agregados) → JSON: `ivc_mean: 53.6, pop_high_risk: 502...`
- Tiles renderizados PNG bajo demanda → URL `{z}/{x}/{y}` que MapLibre consume directo desde `earthengine.googleapis.com`

---

## El Índice de Vulnerabilidad Compuesto (IVC)

Es el "número mágico" que combina 5 factores espaciales en un solo score 0–100 por píxel.

**Fórmula canónica** (idéntica a la del prototipo, ver `apps/api/ahora/gee/layers.py`):

```
IVC = 0.30 · agua_histórica
    + 0.20 · (1 − pendiente/30)        ← terrenos planos pesan más
    + 0.20 · cercanía_a_agua_recurrente
    + 0.15 · superficie_construida
    + 0.15 · densidad_población
```

- Cada componente se normaliza a [0, 1] antes de multiplicar por el peso.
- El resultado se escala a 0–100.
- IVC > 60 = "riesgo alto" (umbral del prototipo).

**¿Por qué esos pesos?** Vienen del prototipo `AGUA & ASFALTO v3.0` del usuario. Reflejan la intuición de que el factor más determinante es **dónde hubo agua antes** (30%), seguido por la topografía y la cercanía hidráulica (20% cada uno), y finalmente la exposición urbana (15% + 15%). Son ajustables vía `IvcParams` en `apps/api/ahora/models.py`.

---

## Las 8 capas del mapa

Cuando abrís `/cuenca/rimac`, el backend genera 8 tile-layers raster en GEE y devuelve sus URLs `{z}/{x}/{y}`. MapLibre las apila sobre la imagen satelital base.

| Capa | ID interno | Por defecto | Significado |
|---|---|---|---|
| 💧 Extensión máx. histórica | `agua_max` | ✓ visible | Sombra azul tenue: TODO sitio donde alguna vez hubo agua superficial (JRC max_extent). |
| 🌊 Intensidad agua (años) | `agua_freq` | ✓ visible | Rampa blanco→azul profundo: cuántos años en 1984–2021 hubo agua en cada píxel. Visualiza ríos persistentes vs estacionales. |
| 💠 Agua recurrente | `agua_recurrente` | oculta | Solo píxeles con ≥3 años de agua, en azul oscuro sólido. |
| 🏗️ Año aparición urbana | `urbano_temporal` | ✓ visible | Rampa amarillo→marrón: cuándo apareció por primera vez construcción ahí (GHSL Built). **La capa más vistosa.** Distingue urbanización vieja (amarillo) de invasiones recientes (marrón oscuro). |
| 🆕 Expansión 1990→2020 | `urb_nuevo` | oculta | Solo lo construido entre 1990 y 2020 (la mancha de crecimiento). |
| 🎯 IVC (semáforo) | `ivc` | oculta | Rampa verde→amarillo→rojo: el índice combinado por píxel. |
| ⚠️ Riesgo medio (antiguo) | `riesgo_antiguo` | ✓ visible | Polígonos naranja: urbano viejo en zona de agua. |
| 🚨 Riesgo ALTO (nuevo) | `riesgo_nuevo` | ✓ visible | Polígonos rojo magenta: urbanización post-1990 que pisó cauce o quebrada. **Este es "el problema" en una capa.** |

---

## El pipeline de alerta

Cuando se ejecuta un replay o un cron, el backend dispara una orquestación de 6 pasos. Cada paso queda registrado en Postgres con estado, intento, input/output y errores. Si algo falla, se reintenta con backoff exponencial; si el proceso muere, al reiniciar retoma desde el último paso exitoso (igual que Azure Durable Functions).

```
       ┌────────────────────────────────────────────────────────────┐
       │  POST /replay {"event": "rimac-2017-03-15"}                 │
       └────────────────────────────┬───────────────────────────────┘
                                    ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Pipeline "replay" (apps/api/ahora/orchestrator/pipelines.py)       │
   │                                                                    │
   │  1. load-event        → busca payload pre-cableado del evento     │
   │  2. load-cuenca       → query Postgres + ST_AsGeoJSON(aoi)        │
   │  3. inject-rain       → INSERT rain_daily con mm reales del evento │
   │  4. load-ivc          → llama compute_ivc() en GEE                 │
   │  5. persist-event     → INSERT alert_event con severidad calculada │
   │  6. notify-console    → encola N SMS en sms_outbox + imprime stdout │
   └───────────────────────────────────────────────────────────────────┘
```

**Severidad** se calcula con `mm_lluvia / umbral_p95`:
- `>= 4×` umbral → **extreme**
- `>= 2×` umbral → **high**
- `>= 1.2×` umbral → **medium**
- resto → **low**

Para Chosica, el umbral p95 está seedeado en 18.5 mm/24h (valor conservador; en producción se recalcula por GEE con la climatología CHIRPS 1981–2020).

---

## Flujo end-to-end de una alerta

Cuando apretás "Disparar replay" en `/replay`:

1. **Frontend** → `POST /replay {"event": "rimac-2017-03-15"}`
2. **Backend** crea un `workflow_run` con `status=pending` en Postgres y empieza a ejecutar los 6 steps.
3. **Step 3 (inject-rain)** persiste la lluvia histórica (95 mm/24h del huaico 2017-03-15) en `rain_daily`.
4. **Step 4 (load-ivc)** llama a GEE. Si el resultado ya está cacheado en `ivc_run`, lo reutiliza (8 s ahorrados). Si no, computa los 8 layers + stats.
5. **Step 5 (persist-event)** evalúa severidad → "extreme" (95 mm / 18.5 mm p95 = 5.1×) e inserta una fila en `alert_event` con el mensaje formateado.
6. **Step 6 (notify-console)** busca con PostGIS (`ST_DWithin`) todos los `subscriber` activos dentro de 20 km del centro de la cuenca, e inserta un SMS por cada uno en `sms_outbox`. Además imprime en stdout del servidor.
7. **Backend** responde con `{status: "success", run_id, context: {...}}`.
8. **Frontend** llama a `router.refresh()` → Next.js re-renderiza `/alertas` y `/admin/outbox` con la nueva data.
9. **Panel SSE** en `/admin/outbox` (poll cada 2 s) detecta los nuevos SMS y los añade a la lista con animación.

---

## Esquema de la base de datos

(detalle completo en `apps/api/db/schema.sql`)

```
cuenca          ──┬── case_study     ← casos emblemáticos por cuenca
                  ├── rain_daily     ← serie diaria CHIRPS / GFS / replay
                  ├── rain_threshold ← p95 por cuenca (climatología)
                  ├── ivc_run        ← cache de cómputos GEE
                  └── alert_event ──┬── sms_outbox ← bandeja simulada
                                    └── (run_id → workflow_run)

workflow_run ──── workflow_step ← step runner con retries y checkpoint

enso_event      ← eventos ENSO fuertes (1983, 1998, 2017, 2023, ...)
subscriber      ← residentes/autoridades con ubicación
```

PostGIS se usa para:
- Guardar `cuenca.centro` (Point), `cuenca.geom_aoi` (Polygon), `subscriber.zona` (Point), `alert_event.area` (MultiPolygon)
- Query `ST_DWithin` para encontrar suscriptores dentro de un radio
- Devolver geometrías al frontend con `ST_AsGeoJSON`

---

## Por qué este diseño

| Decisión | Alternativa | Por qué la nuestra |
|---|---|---|
| Tiles XYZ servidos por GEE (no exportar GeoTIFF local) | Exportar COG, servir con rio-tiler | Cero almacenamiento local, latencia sub-segundo desde el browser, se actualiza si cambia el dataset upstream. |
| Step runner casero en Postgres | Celery / RQ / Dramatiq | Sin Redis ni broker extra; un solo container Postgres; semántica idéntica a Azure Durable Functions para portar luego. |
| MapLibre GL (no Mapbox) | Mapbox GL JS, Leaflet | Open source, sin token de API, soporta tiles raster y vector. |
| Esri World Imagery como basemap | Mapbox satellite | Sin API key, calidad similar para Lima. Para producción se cambiaría a un proveedor con TOS comercial. |
| `getMapId()` con cache in-memory de 30 min | Cache en Postgres con TTL | Los URLs de tile incluyen tokens que duran horas — 30 min es seguro. Más rápido que ida y vuelta a DB. |
| Service account JSON en `secrets/` local | Variables de entorno multi-línea | Más cómodo para iterar; en producción se rotaría y movería a Azure Key Vault. |
| Notificación por stdout + tabla outbox | Twilio sandbox | Twilio no estaba provisionado; el simulador es visualmente impactante para demo y se reemplaza por un adaptador en 10 LOC. |

---

## Próximas extensiones (donde tocar)

| Quiero... | Archivo principal |
|---|---|
| Agregar otra cuenca piloto | `apps/api/db/seeds/case_studies.sql` (INSERT en `cuenca`) |
| Cambiar pesos del IVC | `apps/api/ahora/gee/layers.py` (función `build_layer_stack`) |
| Agregar una capa nueva | `apps/api/ahora/gee/layers.py` (función `_images_to_tile_layers` + `PALETTES`) |
| Cambiar el texto del SMS | `apps/api/ahora/orchestrator/pipelines.py` (variable `msg` en `_replay_persist`) |
| Conectar Twilio o Azure SMS | crear `SmsProvider` en `ahora/notify/` y leer `SMS_PROVIDER` env |
| Agregar pronóstico GFS al cron | función `get_gfs_forecast` ya existe; activar en `monitor_pipeline` |
| Cambiar el basemap | `apps/web/components/risk-map.tsx` (constante `HYBRID_STYLE`) |
| Agregar suscriptores reales | INSERT manual en `subscriber` con `ST_SetSRID(ST_MakePoint(lon,lat), 4326)` |
