# Integración WhatsApp vía Kapso

Esta guía explica cómo conectar AHORA con WhatsApp Business usando [Kapso](https://kapso.ai), incluyendo **opt-in por municipalidad y por zona geográfica** — solo reciben alertas los residentes que se suscribieron y declararon vivir en el área cubierta.

## Cómo funciona (modelo conceptual)

```
                     ┌─────────────────────────────────┐
                     │   Municipalidad de Chosica       │
                     │   - tiene un Kapso WhatsApp URL  │
                     │   - lo difunde en redes sociales │
                     │   - lo imprime en papeletas      │
                     └────────────────┬─────────────────┘
                                      │ comparte link
                                      ▼
              ┌────────────────────────────────────────────┐
              │  https://kapso.ai/chat/xxxxx               │
              │  El residente abre WhatsApp y dice:        │
              │  "Quiero alertas de Chosica, vivo en       │
              │   Pedregal Chico"                          │
              └────────────────┬───────────────────────────┘
                               │ Kapso → webhook AHORA
                               ▼
              ┌────────────────────────────────────────────┐
              │  POST /webhooks/kapso (nuevo en AHORA)     │
              │  - valida la firma                          │
              │  - geocodifica "Pedregal Chico" o usa GPS  │
              │  - inserta en subscriber con                │
              │    municipality_id=chosica, canal=whatsapp │
              │    zona=geometry(lat,lon)                   │
              └────────────────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────────────┐
              │  Cuando hay alerta:                        │
              │  WHERE municipality_id=chosica             │
              │    AND canal='whatsapp'                    │
              │    AND ST_DWithin(zona, polígono, 0)       │
              │  → enviar plantilla aprobada por Meta      │
              └────────────────────────────────────────────┘
```

**Quién controla qué:**
- **La municipalidad** decide a quién le da el link (lo publica o no).
- **El residente** decide suscribirse o no, y declara su zona.
- **AHORA** decide quién recibe cada alerta específica intersectando la zona declarada con el polígono de riesgo.

---

## Paso 1 — Crear cuenta de Kapso

1. Andá a <https://kapso.ai> y registrate como organización.
2. Verificá tu número de WhatsApp Business (Meta exige business verification para enviar mensajes masivos).
3. En el dashboard de Kapso, creá un **flow** llamado `ahora-opt-in`. Lo configurás en el paso 3.
4. Anotá el **link público del chat** (algo como `https://kapso.ai/chat/abc123`).

> 💡 Para hackatón / desarrollo, Kapso ofrece un sandbox sin verificación de Meta — limitado a 5 contactos pre-aprobados pero suficiente para demo.

## Paso 2 — Registrar el link en la municipalidad

Una vez tenés el link, lo asociás a la municipalidad en AHORA:

```sql
-- desde pnpm db:psql
UPDATE municipality
SET whatsapp_kapso_url = 'https://kapso.ai/chat/abc123'
WHERE id = 'chosica';
```

O por API (cuando esté el endpoint admin):

```bash
curl -X PATCH http://localhost:8000/municipalities/chosica \
  -H "content-type: application/json" \
  -d '{"whatsapp_kapso_url": "https://kapso.ai/chat/abc123"}'
```

A partir de ahí, el link aparece como botón "Suscribirme por WhatsApp" en la página pública de Chosica.

## Paso 3 — Configurar el flow en Kapso

El flow `ahora-opt-in` debe:

1. **Saludar**: "Hola, soy AHORA. Te enviaré alertas tempranas de inundaciones y huaicos en tu zona."
2. **Pedir ubicación**: enviá un mensaje pidiendo "Compartí tu ubicación" o "Decime tu dirección o el AAHH donde vivís".
3. **Recoger consentimiento explícito** (requerido por Meta y por la Ley 29733 de Protección de Datos Personales en Perú):
   > "¿Aceptás recibir mensajes de alerta de emergencia? Respondé SÍ para confirmar."
4. **Llamar al webhook de AHORA** con los datos:

```jsonc
// POST → https://AHORA_URL/webhooks/kapso
{
  "event": "opt_in",
  "municipality_hint": "chosica",   // viene del link clickeado
  "wa_number": "+51987654321",
  "nombre": "María",
  "ubicacion": { "lat": -11.928, "lon": -76.692 },
  "ubicacion_texto": "AAHH Pedregal Chico",
  "consent_at": "2026-05-17T15:30:00Z"
}
```

## Paso 4 — Implementar el webhook en AHORA

Agregá un router nuevo:

```python
# apps/api/ahora/routers/webhooks.py
from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
import hmac, hashlib, os

from ahora.db import get_session

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/kapso")
async def kapso_webhook(payload: dict, x_kapso_signature: str = Header(...)):
    # Verificar firma
    secret = os.environ["KAPSO_WEBHOOK_SECRET"].encode()
    expected = hmac.new(secret, json.dumps(payload).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_kapso_signature):
        raise HTTPException(401, "bad signature")

    if payload.get("event") == "opt_in":
        loc = payload["ubicacion"]
        async with get_session() as s:
            await s.execute(text("""
                INSERT INTO subscriber
                    (municipality_id, nombre, telefono, zona, rol, canal, opt_in_at, activo)
                VALUES
                    (:m, :n, :t,
                     ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                     'residente', 'whatsapp', :ts, true)
                ON CONFLICT (telefono) DO UPDATE SET
                    zona = EXCLUDED.zona,
                    opt_in_at = EXCLUDED.opt_in_at,
                    activo = true
            """), {
                "m": payload["municipality_hint"],
                "n": payload.get("nombre"),
                "t": payload["wa_number"],
                "lon": loc["lon"], "lat": loc["lat"],
                "ts": payload["consent_at"],
            })
            await s.commit()
    return {"ok": True}
```

Registralo en `main.py` y agregá `KAPSO_WEBHOOK_SECRET` a `.env`.

## Paso 5 — Reemplazar el simulador SMS por Kapso para canal WhatsApp

En `apps/api/ahora/orchestrator/pipelines.py`, dentro de `_replay_notify` (o `_step_notify`):

```python
# Buscar suscriptores con canal=whatsapp en el polígono de la alerta
subs = await s.execute(text("""
    SELECT s.id, s.telefono, s.nombre, s.canal
    FROM subscriber s
    JOIN municipality_cuenca mc ON mc.municipality_id = s.municipality_id
    WHERE mc.cuenca_id = :c
      AND s.activo = true
      AND ST_DWithin(s.zona::geography, c.centro::geography, 20000)
"""), {"c": cuenca["id"]})

for sub_id, telefono, nombre, canal in subs:
    if canal == "whatsapp":
        await send_whatsapp_via_kapso(telefono, plantilla_alerta(pers))
    elif canal == "sms":
        # ... el simulador actual
```

Y el cliente de Kapso:

```python
# apps/api/ahora/notify/kapso.py
import httpx, os

async def send_whatsapp_via_kapso(to: str, body: str):
    async with httpx.AsyncClient() as cli:
        r = await cli.post(
            "https://api.kapso.ai/v1/messages",
            headers={"Authorization": f"Bearer {os.environ['KAPSO_API_KEY']}"},
            json={
                "to": to,
                "template": "ahora_alerta_v1",  # plantilla aprobada por Meta
                "components": [{"type": "body", "parameters": [{"text": body}]}],
            },
            timeout=10.0,
        )
        r.raise_for_status()
```

## Paso 6 — Plantillas de WhatsApp (Meta Approval)

Meta exige que las plantillas estén pre-aprobadas. Subí esta a Kapso → Templates:

**Nombre**: `ahora_alerta_v1`
**Categoría**: `UTILITY` (alertas de servicio público, no marketing)
**Idioma**: `es_PE`

```
🚨 ALERTA {{1}} — {{2}}

{{3}}

Si estás en esta zona, alejate de cauces y quebradas.
Sigue indicaciones de Defensa Civil ({{4}}).

Respondé STOP para dejar de recibir.
```

Variables: `{{1}}=severidad`, `{{2}}=cuenca/foco`, `{{3}}=mensaje libre`, `{{4}}=teléfono local`.

> Aprobación de Meta tarda 24–48 h. Mientras tanto, Kapso permite enviar **session messages** (cliente escribió en últimas 24 h) sin plantilla.

## Paso 7 — Variables de entorno

Agregá a `apps/api/.env`:

```
KAPSO_API_KEY=k_live_...
KAPSO_WEBHOOK_SECRET=cualquier_string_aleatorio_>=32_chars
```

Y configurá la URL del webhook en el dashboard de Kapso:
```
https://tu-backend.example.com/webhooks/kapso
```
(Para desarrollo, usá [ngrok](https://ngrok.com) para exponer `localhost:8000`.)

---

## Privacidad y cumplimiento

- **Consentimiento explícito**: el residente debe enviar "SÍ" antes de quedar suscrito.
- **Botón STOP**: cualquier respuesta `STOP`/`BAJA` desactiva al suscriptor (`activo=false`).
- **Datos mínimos**: solo guardamos número, nombre opcional, zona (un Point), municipality_id. No medical, no income, no demographics.
- **Retención**: si el suscriptor se da de baja, mantenemos el row con `activo=false` por 30 días para auditoría y luego se borra (cron diario).
- **Acceso por municipalidad**: cada municipio solo puede ver/exportar sus suscriptores (no los de otras). Cuando se conecte Microsoft Entra, esto se enforce con OIDC claims.

## Costos estimados (Kapso)

A 2026: WhatsApp utility messages a Perú cuestan ~$0.005–0.015 USD por mensaje (Meta) + fee de Kapso. Para Chosica con 10,000 suscriptores activos:
- 1 alerta extrema/mes × 10k usuarios = ~$50–150 USD/mes
- Mensaje proactivo de drill mensual = otros $50–150
- Total estimado: **~$200 USD/mes** por municipalidad de 100k habitantes

Comparable al costo de **1 SMS masivo de Movistar/Claude** (~$0.05 c/u = $500 USD por la misma cantidad).

## Alternativas

Si la municipalidad ya tiene un canal Microsoft Teams (porque usa MS 365), el campo `municipality.teams_webhook_url` permite mandar la alerta directo al canal de Defensa Civil sin pasar por WhatsApp — útil para alertas **internas** entre funcionarios (no a residentes).
