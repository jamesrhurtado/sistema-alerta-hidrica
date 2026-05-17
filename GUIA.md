# Guía de uso — AHORA

> Para usuarios nuevos: cómo usar la app, qué hace cada página y cada botón, y cómo correr la demo del hackatón.

---

## El concepto del producto

**AHORA es un sistema multi-tenant para gobiernos locales (municipalidades).**

Cada municipalidad:
1. **Ingresa con su cuenta institucional Microsoft** (`alcalde@munichosica.gob.pe`, etc.)
2. **Ve solo sus cuencas** monitoreadas en el dashboard
3. **Recibe alertas** cuando hay riesgo inminente, por SMS / WhatsApp / Microsoft Teams
4. **Distribuye un link público** para que sus residentes opt-in a recibir alertas en su WhatsApp

**Para la demo:** la municipalidad de Lurigancho-Chosica monitorea la cuenca del Rímac.

---

## Antes de empezar

Asegurate de tener **3 procesos corriendo en paralelo** (3 terminales):

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

## Las páginas de la app

### 🚪 `/login` — Ingreso

**Cuándo aparece:** la primera vez, o cuando cerrás sesión.

**Qué muestra:**
- Botón grande "**Continuar con Microsoft**" (en producción inicia OAuth con Entra ID; en demo está deshabilitado — ver [MS_AUTH.md](MS_AUTH.md) para activarlo)
- Lista de **municipalidades demo** para elegir como si te hubieras autenticado:
  - Municipalidad de Lurigancho-Chosica (la principal para demo)
  - Municipalidad Metropolitana de Lima
  - Municipalidad Provincial de Piura
  - Municipalidad Distrital de Catacaos

**Qué podés hacer:**
- ✅ Click en cualquier municipalidad → setea una cookie con tu sesión y te lleva al `/`

---

### 🏠 `/` — Inicio (panel de la municipalidad)

**Qué muestra (cuando estás logueado como Chosica):**
- Encabezado: "**Municipalidad de Lurigancho-Chosica · Panel de monitoreo hídrico**"
- **4 KPIs grandes**:
  - Cuencas monitoreadas (1 para Chosica: Rímac)
  - Alertas últimas 24h
  - Población en riesgo alto (0 si no hay datos, no `—`)
  - IVC promedio
- **Tus cuencas**: solo las asignadas a tu municipalidad. Cada tarjeta tiene un CTA "Abrir mapa interactivo →".
- **Alertas recientes**: las últimas 5.

**Si no hay sesión** (cerraste sesión o no entraste todavía):
- Encabezado dice "Sin sesión · vista pública"
- Muestra las 3 cuencas piloto del sistema entero
- Botón visible "Ingresar como municipalidad"

---

### 🗺️ `/cuenca/rimac` — Mapa interactivo (la página estrella)

**Cómo llegar:**
- Desde la barra de navegación → "🗺️ Mapa"
- Desde el inicio → click en la tarjeta "Cuenca del Rímac"

**Qué muestra:**

1. **Mapa central** con satélite Esri + nombres OSM superpuestos + **5 capas raster** de Google Earth Engine apiladas (reducidas desde 8 para evitar confusión).

2. **Panel "Capas"** (arriba izquierda), agrupado en 2 secciones:
   - **🚨 Riesgo (principal)** — 3 capas, las 3 activas por defecto:
     - 🎯 Nivel de vulnerabilidad (IVC) — el semáforo verde→rojo
     - 🚨 Riesgo ALTO — polígonos rojos de invasiones sobre cauce
     - ⚠️ Riesgo medio — polígonos naranja de urbanización antigua en zona de agua
   - **📊 Contexto (opcional)** — 2 capas, ocultas por defecto:
     - 🌊 Historial de agua (1984–2021)
     - 🏗️ Crecimiento urbano (1990→2020)

3. **Leyenda dinámica** (abajo derecha): se actualiza solo con lo que esté activo.

4. **Resumen del análisis** (panel derecho): números calculados en vivo por GEE:
   - Expansión urbana total y la fracción en zona inundable (con alerta si > 5%)
   - Población en RIESGO ALTO (destacado en rojo)
   - IVC promedio y máximo
   - Área urbana total

5. **¿Qué es el IVC?** (panel desplegable): explica los 5 factores del índice, los pesos y los rangos del semáforo. **Tocalo si no entendés el número 0–100.**

6. **Alertas en esta cuenca**: histórico de alertas creadas por simulaciones.

7. **Casos emblemáticos**: con descripción.

**Para el demo:**
- Apagá las 2 capas de Contexto. Quedate con IVC + ambos riesgos.
- Hacé zoom a Chosica. Vas a ver el semáforo (verde→amarillo→rojo) pintando manzanas, y polígonos rojos magenta marcando las invasiones críticas sobre la quebrada Pedregal.

---

### 🔔 `/alertas` — Historial de alertas

**Qué muestra:** todas las alertas creadas, ordenadas por fecha desc. Cada una con badge de severidad, mm de lluvia, IVC máx, población estimada y mensaje completo.

---

### 📱 `/admin/outbox` — Bandeja simulada de SMS

**Qué muestra:** todos los SMS encolados, agrupados como una bandeja con polling en vivo (cada 2 s). Sirve para visualizar exactamente qué texto recibiría cada suscriptor cuando se conecte Twilio/Kapso real.

**Para conectar WhatsApp real:** ver [KAPSO_WHATSAPP.md](KAPSO_WHATSAPP.md).

---

### 🧪 `/admin/simulacion` — Simulación de escenarios

> Antes se llamaba "Replay". Ahora reframeado con propósito claro:

**Para qué sirve:**
- 🎯 **Drill de emergencia**: tu equipo de Defensa Civil necesita practicar la respuesta. Disparás un escenario, verificás que reciben la alerta, que la lista de evacuación se imprime, y que el dashboard refleja la situación.
- 🛡️ **Justificación presupuestal**: para mostrarle al concejo "si pasara lo de 2017 hoy, son 502 personas a evacuar; el sistema cuesta $200/mes". Cada simulación produce un reporte.
- 🧪 **Validación técnica**: ¿el sistema detectaría el huaico de marzo 2017 con 24h de anticipación? Disparás y comparás severidad calculada vs daño real.

**Qué eventos están disponibles:**
| Evento | Fecha | Lluvia 24h | Contexto |
|---|---|---|---|
| `rimac-2017-03-15` | 15 mar 2017 | 95 mm | Huaico Carretera Central |
| `piura-2017-03-27` | 27 mar 2017 | 220 mm | El Niño Costero, Piura |
| `lima-2023-03-13` | 13 mar 2023 | 78 mm | Ciclón Yaku |

**Qué hace cuando apretás "Simular escenario":**
1. Inyecta la lluvia histórica en la cuenca
2. Recalcula IVC con GEE
3. Evalúa severidad (lluvia/p95 > 4× → EXTREMA)
4. Persiste `alert_event`
5. Encola SMS/WhatsApp para todos los suscriptores en el radio
6. Aparece en `/alertas` y `/admin/outbox`

**No envía nada real** hasta que conectes Twilio/Kapso/Teams (instrucciones en KAPSO_WHATSAPP.md y MS_AUTH.md).

---

## La nav bar

| Botón | A dónde lleva | Para qué |
|---|---|---|
| AHORA (logo) | `/` | Home |
| **Inicio** | `/` | Panel de la municipalidad logueada |
| **🗺️ Mapa** | `/cuenca/rimac` | Mapa interactivo con capas GEE |
| **🔔 Alertas** | `/alertas` | Historial de alertas |
| **📱 Outbox** | `/admin/outbox` | Bandeja SMS simulados con polling |
| **🧪 Simulación** | `/admin/simulacion` | Disparar escenarios históricos (drill) |
| **Badge derecha** | `/login` | Nombre de la municipalidad logueada o botón de login |

---

## Demo de 90 segundos (orden recomendado)

1. **`/login`** — "AHORA es multi-tenant. Cada municipalidad ingresa con su cuenta Microsoft institucional. Para la demo voy a entrar como **Lurigancho-Chosica**."

2. **`/`** — "Este es mi panel. Veo solo la cuenca que monitorea Chosica: el Rímac. 502 habitantes en riesgo alto, IVC promedio 53.6."

3. **Click en tarjeta Rímac → `/cuenca/rimac`** — "El corazón del producto. 5 capas raster del análisis combinado, servidas en tiempo real por Google Earth Engine. El IVC en semáforo verde→rojo es la headline; los polígonos rojos son invasiones post-1990 sobre cauces. **34.8 hectáreas, 9.6% de toda la expansión urbana reciente.**"

4. **Abrir explainer del IVC** — "Para el alcalde no técnico: el índice combina 5 factores. Agua histórica 30%, pendiente 20%, cercanía a ríos 20%, construcción 15%, población 15%. Cualquier píxel sobre 60 es riesgo alto."

5. **`/admin/simulacion`** → click en `rimac-2017-03-15` — "Drill: simulamos el huaico de marzo 2017. ¿El sistema lo habría detectado? Disparo… listo."

6. **Tab `/admin/outbox`** — "Acá los 4 SMS que se enviarían a 3 residentes opt-in + Defensa Civil. **En producción, esto va por WhatsApp via Kapso** — el residente se suscribió compartiendo su ubicación, y solo recibe alertas de su zona declarada."

7. **Cerrar con `/alertas`** — "Severidad EXTREMA, lluvia 5× sobre el percentil 95 local. Si esto hubiera estado activo el 14 de marzo 2017, esas familias se evacúan."

---

## Resolución de problemas comunes

| Síntoma | Causa probable | Cómo lo arreglo |
|---|---|---|
| El mapa sale en blanco | CSS de MapLibre no cargó | `Cmd+Shift+R` para limpiar caché del browser. |
| `/cuenca/rimac` tarda 15s en cargar | Primera llamada a GEE genera 5 mapIds | Normal. Subsiguientes son < 50ms (cache). |
| No hay datos / 500 en `/cuencas` | Postgres no levantó o seeds no cargaron | `pnpm db:logs`. Si falló, `pnpm db:reset`. |
| "modo mock" aparece | Falta credencial GEE en `.env` | Editá `apps/api/.env` → `GEE_SERVICE_ACCOUNT_JSON=./secrets/gee-sa.json`. |
| Replay/simulación falla | Postgres no acepta el formato fecha | Ya corregido. Si pasa, reiniciá `pnpm api:dev`. |
| Los SMS no aparecen en `/admin/outbox` | El polling está pausado | Click en "Reanudar" en la esquina sup. der. |

---

## Atajos útiles

```bash
# DB
pnpm db:psql                                # consola psql al container
pnpm db:reset                                # destruye y vuelve a seedear

# API
curl http://localhost:8000/health           # ¿GEE conectado? ¿DB OK?
curl http://localhost:8000/docs             # Swagger interactivo
curl http://localhost:8000/municipalities   # lista de municipalidades

# Simular desde CLI (sin abrir la web)
curl -X POST http://localhost:8000/replay \
  -H "content-type: application/json" \
  -d '{"event":"rimac-2017-03-15"}'
```

---

## Cuando estés listo para producción

1. **Microsoft Entra (sign-in real)**: ver [MS_AUTH.md](MS_AUTH.md)
2. **WhatsApp via Kapso (alertas reales)**: ver [KAPSO_WHATSAPP.md](KAPSO_WHATSAPP.md)
3. **Despliegue Azure + Vercel**: ver [PLAN.md → Pendientes](PLAN.md#pendientes-post-hackatón)
