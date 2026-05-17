# Guía de uso — AHORA

> Para usuarios nuevos: cómo usar la app, qué hace cada página y cada botón, y cómo correr la demo del hackatón.

## Antes de empezar

Asegurate de tener **3 procesos corriendo en paralelo** (3 terminales o 3 tabs en tu terminal):

```bash
# Terminal 1 — base de datos
cd /Users/james/dev/ai-hack-v2
pnpm db:up

# Terminal 2 — backend FastAPI + GEE
pnpm api:dev

# Terminal 3 — frontend Next.js
pnpm dev
```

Esperá a que los tres digan "ready / running / healthy" y abrí: **<http://localhost:3000>**

> Si es la primera vez, antes corré `pnpm install` y `pnpm api:install` una sola vez.

---

## Las 5 páginas de la app

### 🏠 `/` — Inicio (vista nacional)

Lo primero que ves al abrir la app. Resumen agregado del país.

**Qué muestra:**
- **4 KPIs grandes arriba**:
  - Cuencas monitoreadas (3 en el MVP: Rímac, Piura, Chillón)
  - Alertas últimas 24h
  - Población en riesgo alto (suma de IVC > 60 en todas las cuencas)
  - IVC promedio nacional
- **Cuencas piloto**: 3 tarjetas grandes, una por cuenca. Cada tarjeta tiene IVC máx, población en riesgo y un link "**Abrir mapa interactivo →**".
- **Alertas recientes**: si hubo replays ejecutados, las últimas 5 alertas con su severidad.

**Qué podés hacer:**
- ✅ **Click en cualquier tarjeta de cuenca** → abre el mapa interactivo de esa cuenca.
- ✅ **Botón "Disparar replay histórico"** (arriba derecha) → te lleva a `/replay`.

---

### 🗺️ `/cuenca/rimac` — Mapa interactivo (la página estrella)

**Cómo llegar:**
- Desde la barra de navegación → "🗺️ Mapa Chosica"
- Desde el inicio → click en la tarjeta "Cuenca del Rímac"

**Qué muestra:**

1. **Mapa central** con base satelital (Esri) + nombres OSM superpuestos + 8 capas raster de Google Earth Engine apiladas.

2. **Panel "Capas"** (arriba izquierda): checkboxes agrupados en 3 secciones para alternar qué capas ves. **Tocá cada checkbox para apilar/quitar capas en vivo** — los tiles se cargan dinámicamente desde GEE.

3. **Leyenda dinámica** (abajo derecha): rampas de color que se actualizan según las capas activas. Solo muestra las leyendas relevantes.

4. **Resumen del análisis** (panel derecho): los mismos números que mostraba tu prototipo Code Editor:
   - **Expansión urbana total** (ha)
   - **Sobre/cerca de agua** (ha y %) — el indicador clave
   - **Urb. antiguo en zona de agua** (ha)
   - **Pob. en RIESGO ALTO** (hab.) — destacado en rojo
   - **Pob. total expuesta** (hab.)
   - **IVC promedio y máximo** (0–100)
   - **Área urbana total** (ha)
   - Banner rojo si la expansión inundable supera el 5%

5. **Alertas en esta cuenca**: histórico de alertas creadas por replays.

6. **Casos emblemáticos**: Chosica - Quebrada Pedregal, con descripción.

**Qué podés hacer:**

| Acción | Cómo |
|---|---|
| Activar/desactivar una capa | Click en su checkbox en el panel "Capas" |
| Pan (mover) el mapa | Arrastrar con el mouse |
| Zoom | Rueda del mouse, o pinch en trackpad, o botones +/− arriba derecha |
| Ver detalle de un caso emblemático | Click en el marcador amarillo |
| Cerrar/abrir el panel "Capas" | Click en el header "Capas −" |

**Lo más impactante visualmente:**
- Apagá todas las capas excepto "🏗️ Año aparición urbana" — verás la mancha amarillo→marrón mostrando dónde y cuándo creció la ciudad.
- Sumá "🚨 Riesgo ALTO (nuevo)" — los polígonos rojos muestran exactamente las invasiones post-1990 sobre cauces. **Esa es la historia.**

---

### ⏪ `/replay` — Replay de eventos históricos

**Cómo llegar:** nav → "⏪ Replay" o desde el botón del home.

**Qué muestra:** lista de 3 eventos históricos precableados:

| Evento | Fecha | Lluvia 24h | Contexto |
|---|---|---|---|
| `rimac-2017-03-15` | 15 mar 2017 | 95 mm | Huaico Carretera Central, quebrada Pedregal Chico |
| `piura-2017-03-27` | 27 mar 2017 | 220 mm | El Niño Costero, desborde río Piura |
| `lima-2023-03-13` | 13 mar 2023 | 78 mm | Ciclón Yaku, lluvias en Lima costera |

**Qué podés hacer:**

- ✅ **Botón "Disparar replay"** en cada evento → ejecuta el pipeline completo (6 steps) contra la cuenca correspondiente:
  1. Carga el evento
  2. Carga la cuenca con su AOI
  3. Inyecta la lluvia histórica en `rain_daily`
  4. Calcula IVC contra GEE (o usa cache si ya está)
  5. Persiste un `alert_event` con severidad calculada
  6. Encola SMS para cada suscriptor en la zona, los imprime en stdout

  Cuando termina, vas a ver: "✔ Pipeline completado. Generadas alertas + outbox."

**Para la demo:**
1. Apretá replay en `rimac-2017-03-15`.
2. Abrí en otra tab `/alertas` y `/admin/outbox` — vas a ver el evento nuevo y los 4 SMS.
3. Mirá el stdout del backend (terminal 2) — los SMS aparecen impresos con formato ASCII.

---

### 🔔 `/alertas` — Historial de alertas

**Qué muestra:** todas las alertas creadas, ordenadas por fecha desc. Cada una tiene:
- Badge de severidad (BAJA / MEDIA / ALTA / EXTREMA — la extrema pulsa en rojo)
- Fecha y cuenca
- mm de lluvia 24h, IVC máx, población estimada
- Mensaje completo formateado (con emoji 🚨 y multi-línea)

**Qué podés hacer:**
- Solo leer. Esta página refleja el estado de `alert_event` en Postgres.
- Si está vacía, apretá un replay primero.

---

### 📱 `/admin/outbox` — Bandeja simulada de SMS

**Qué muestra:** todos los SMS encolados en `sms_outbox`, agrupados visualmente como una bandeja:
- Ícono de teléfono
- Número destino (+51 999 000 ...)
- Severidad badge
- Mensaje exacto que recibiría el suscriptor

**Tope superior:** indicador "Streaming en vivo (poll 2s)" con ícono pulsante.

**Qué podés hacer:**
- ✅ **Pausar/Reanudar** el polling — útil si querés congelar la pantalla durante una demo.
- Refrescar la página manualmente para forzar recarga.

**Para la demo:**
Mantenelo abierto en una tab mientras disparás un replay desde otra. Vas a ver los nuevos SMS aparecer animados con un slide-in en ≤2 segundos.

---

## La nav bar

| Botón | A dónde lleva | Qué ves |
|---|---|---|
| AHORA (logo) | `/` | Home |
| **Inicio** | `/` | KPIs nacionales + tarjetas de cuencas |
| **🗺️ Mapa Chosica** | `/cuenca/rimac` | Mapa interactivo con capas GEE |
| **⏪ Replay** | `/replay` | 3 botones para disparar eventos históricos |
| **🔔 Alertas** | `/alertas` | Historial de alertas con severidad |
| **📱 Outbox** | `/admin/outbox` | Bandeja SMS simulados con polling en vivo |

---

## Demo de 90 segundos (orden recomendado)

1. **`/`** — "Esto es AHORA, sistema de alerta temprana de inundaciones para Perú. Vemos 3 cuencas piloto. Solo en Chosica tenemos 502 personas en riesgo alto."

2. **Click en tarjeta Rímac → `/cuenca/rimac`** — "Acá viene el corazón. 8 capas raster servidas en tiempo real por Google Earth Engine. La rampa amarillo→marrón muestra cuándo apareció construcción: el marrón oscuro son invasiones post-2000."

3. **Activar solo "🚨 Riesgo ALTO (nuevo)"** — "Estos polígonos rojos son urbanizaciones nuevas que pisaron cauces y quebradas. 34.8 hectáreas. 9.6% de toda la expansión urbana reciente. En Chosica."

4. **`/replay`** → click en `rimac-2017-03-15` — "Voy a simular el huaico del 15 de marzo 2017. El sistema debería detectar el evento extremo y notificar."

5. **En otra tab `/admin/outbox`** — "Aquí están los 4 SMS que se enviarían a residentes y a Defensa Civil, con texto adaptado a teléfonos básicos. En producción esto va por Twilio. Si fuera 24 horas antes del huaico real, esas familias se evacúan."

6. **Cerrar mostrando `/alertas`** — "Severidad EXTREMA, lluvia 5× sobre el percentil 95 local. Esto es AHORA en acción."

---

## Resolución de problemas comunes

| Síntoma | Causa probable | Cómo lo arreglo |
|---|---|---|
| El mapa sale en blanco | CSS de MapLibre no cargó o WebGL desactivado | `pnpm dev` en `apps/web`, refrescá con Cmd+Shift+R. Revisá F12 → Console por errores `WebGL`. |
| `/cuenca/rimac` tarda 15s en cargar | Primera llamada a GEE genera 8 mapIds | Normal. Subsiguientes son < 50ms (cache). |
| No hay datos / 500 en `/cuencas` | Postgres no levantó o seeds no cargaron | `pnpm db:logs`. Si el seed falló, `pnpm db:reset` para reiniciar limpio. |
| "modo mock" aparece en `/cuenca/rimac` | Falta credencial GEE en `.env` | Editá `apps/api/.env` → `GEE_SERVICE_ACCOUNT_JSON=./secrets/gee-sa.json`. Reinicia `pnpm api:dev`. |
| Replay falla con "DataError" en `inject-rain` | Postgres no acepta el formato fecha | Reiniciá uvicorn (`Ctrl+C` y `pnpm api:dev`) — bug ya corregido. |
| Los SMS no aparecen en `/admin/outbox` | El polling está pausado | Click en "Reanudar" en la esquina superior derecha. |
| Pantalla en negro sin contenido | El servidor Next.js murió | Volvé a correr `pnpm dev` en `apps/web`. |

---

## Atajos útiles

```bash
# DB
pnpm db:psql                                # consola psql al container
pnpm db:reset                                # destruye y vuelve a seedear
docker compose exec db psql -U ahora -d ahora -c "SELECT * FROM alert_event;"

# API
curl http://localhost:8000/health           # ¿GEE conectado? ¿DB OK?
curl http://localhost:8000/docs             # Swagger interactivo
curl http://localhost:8000/layers/rimac     # genera los 8 mapIds (15s primera vez)
curl -X DELETE http://localhost:8000/layers/rimac/cache  # invalidar cache

# Replay desde CLI (sin abrir la web)
curl -X POST http://localhost:8000/replay \
  -H "content-type: application/json" \
  -d '{"event":"rimac-2017-03-15"}'
```

---

## ¿Y después?

Cuando el local te funcione bien y quieras seguir, los siguientes pasos están en [PLAN.md → Pendientes](PLAN.md#pendientes-post-hackatón).

Si querés saber el detalle de cómo funciona internamente cada cosa (de dónde sale cada número, cómo se calculó el IVC, qué pasa cuando apretás un botón), leé [ARCHITECTURE.md](ARCHITECTURE.md).
