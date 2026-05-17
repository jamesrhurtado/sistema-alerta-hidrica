# Autenticación con Microsoft Entra ID (Continue with Microsoft)

Esta guía explica cómo reemplazar el mock-auth de la demo por el flujo real de "Continue with Microsoft" usando Microsoft Entra (ex Azure AD). Las municipalidades del Perú que usan Microsoft 365 podrán ingresar con sus cuentas institucionales (`@munichosica.gob.pe`, etc.).

## Cómo funciona

```
   Funcionario de Chosica
   (alcalde@munichosica.gob.pe)
            │
            │  click "Continue with Microsoft"
            ▼
   ┌─────────────────────────────────────────────┐
   │ login.microsoftonline.com (Entra ID)        │
   │ - autentica al usuario                       │
   │ - obtiene tenant, email, nombre              │
   └────────────────┬────────────────────────────┘
                    │ código OAuth + redirect_uri
                    ▼
   ┌─────────────────────────────────────────────┐
   │ AHORA web · /api/auth/callback/microsoft    │
   │ - intercambia código por token              │
   │ - extrae email del usuario                  │
   │ - mapea email → municipality_id             │
   │   (vía domain_hint o tabla de mapeo)        │
   │ - setea cookie de sesión                    │
   └─────────────────────────────────────────────┘
```

**Mapeo email → municipalidad**: el campo `municipality.domain_hint` (ej. `munichosica.gob.pe`) se compara contra el dominio del email. Si matchea, ese usuario queda asociado a esa municipalidad. Si no matchea ninguna, se le permite seleccionar manualmente (caso: alcalde con email personal).

## Paso 1 — Registrar la app en Microsoft Entra

1. Andá a <https://entra.microsoft.com> con una cuenta admin de tu tenant.
2. Menú → **App registrations** → **+ New registration**.
3. Llenar:
   - **Name**: AHORA
   - **Supported account types**: "Accounts in any organizational directory (multitenant)" — porque querés que cualquier municipalidad con MS365 pueda entrar, no solo tu tenant.
   - **Redirect URI**:
     - Type: `Web`
     - URL: `http://localhost:3000/api/auth/callback/microsoft-entra-id` (desarrollo)
     - Más URLs después para producción.
4. Click **Register**.
5. Anotá:
   - **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → para multitenant usar literal `common`
6. Menú lateral → **Certificates & secrets** → **+ New client secret** → 24 meses → anotá el `Value` (no el ID). → `AUTH_MICROSOFT_ENTRA_ID_SECRET`
7. Menú → **API permissions** → asegurate que `Microsoft Graph › User.Read` esté presente (por defecto sí). No necesitás admin consent para esto.

## Paso 2 — Instalar Auth.js en el frontend

```bash
cd apps/web
pnpm add next-auth @auth/core
```

Crear `apps/web/auth.ts`:

```ts
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: "https://login.microsoftonline.com/common/v2.0",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Llamar al backend para resolver municipality_id por dominio del email.
      const email = user.email ?? "";
      const domain = email.split("@")[1];
      const res = await fetch(`${process.env.API_URL}/auth/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, domain, ms_user_id: account?.providerAccountId }),
      });
      const { municipality_id } = await res.json();
      // Adjuntar al token
      (user as any).municipalityId = municipality_id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.municipalityId = (user as any).municipalityId;
      return token;
    },
    async session({ session, token }) {
      (session as any).municipalityId = token.municipalityId;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
```

Crear `apps/web/app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from "@/auth";
```

## Paso 3 — Reemplazar el botón mock en /login

Actualizar `apps/web/app/login/page.tsx`:

```tsx
import { signIn } from "@/auth";

<form action={async () => { "use server"; await signIn("microsoft-entra-id"); }}>
  <button type="submit" className="w-full ... bg-[#2F2F2F]">
    <svg>...</svg>
    Continuar con Microsoft
  </button>
</form>
```

(Mantén el selector de municipalidad como fallback para usuarios sin email institucional.)

## Paso 4 — Endpoint de resolución en el backend

```python
# apps/api/ahora/routers/auth.py
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from ahora.db import get_session

router = APIRouter(prefix="/auth", tags=["auth"])

class ResolveRequest(BaseModel):
    email: str
    domain: str
    ms_user_id: str | None = None

@router.post("/resolve")
async def resolve_municipality(req: ResolveRequest):
    async with get_session() as s:
        res = await s.execute(
            text("SELECT id FROM municipality WHERE domain_hint = :d"),
            {"d": req.domain},
        )
        row = res.first()

    if row:
        return {"municipality_id": row[0], "matched_by": "domain"}

    # Sin match: dejar que el usuario elija manualmente
    return {"municipality_id": None, "matched_by": "manual"}
```

Y agregá `from ahora.routers import auth` + `app.include_router(auth.router)` en `main.py`.

## Paso 5 — Usar `auth()` en lugar del mock

Reemplazar `apps/web/lib/session.ts`:

```ts
import { auth } from "@/auth";
import { api } from "./api";

export async function getCurrentMunicipality() {
  const session = await auth();
  const id = (session as any)?.municipalityId;
  if (!id) return null;
  try { return await api.municipality(id); } catch { return null; }
}
```

El resto del código (`page.tsx`, `MunicipalityBadge`, etc.) sigue funcionando sin cambios.

## Paso 6 — Variables de entorno

Agregá a `apps/web/.env.local`:

```
AUTH_MICROSOFT_ENTRA_ID_ID=tu-client-id
AUTH_MICROSOFT_ENTRA_ID_SECRET=tu-client-secret
AUTH_SECRET=correr `openssl rand -base64 32`
AUTH_TRUST_HOST=true              # solo en dev / proxies sin HTTPS
NEXTAUTH_URL=http://localhost:3000  # solo en dev
```

Para producción (Vercel), agregá los mismos via `vercel env add`.

## Paso 7 — Configurar mapeo de dominios

```sql
UPDATE municipality SET domain_hint = 'munichosica.gob.pe'  WHERE id = 'chosica';
UPDATE municipality SET domain_hint = 'munlima.gob.pe'      WHERE id = 'lima-metro';
UPDATE municipality SET domain_hint = 'munipiura.gob.pe'    WHERE id = 'piura-prov';
-- agregar más cuando se incorporan municipalidades
```

Después de esto, cuando `alcalde@munichosica.gob.pe` haga sign-in, automáticamente queda asociado a `chosica` sin selección manual.

## Casos de borde

- **Email sin matching de dominio**: mostrar selector de municipalidad después del sign-in.
- **Funcionario que cambia de municipalidad**: agregar endpoint admin `PATCH /users/{ms_id}/municipality` para override manual.
- **Multi-tenancy estricta**: si una municipalidad exige que solo usuarios de SU tenant entren (no multitenant), cambiar `issuer` a `https://login.microsoftonline.com/{TENANT_ID}/v2.0` y filtrar en `signIn` por `account.providerAccountId.startsWith(tenant_prefix)`.
- **Cuentas personales (outlook.com)**: las soportamos pero no resuelven dominio → caen al selector manual.

## Integración con MS Teams (bonus)

Si la municipalidad guardó `teams_webhook_url`, el orchestrator puede mandar la alerta a su canal de Defensa Civil:

```python
# apps/api/ahora/notify/teams.py
import httpx

async def send_to_teams(webhook_url: str, severity: str, message: str):
    card = {
        "@type": "MessageCard",
        "themeColor": {"extreme": "FF0000", "high": "FF8800", "medium": "FFCC00"}.get(severity, "00CC00"),
        "summary": f"AHORA · {severity}",
        "sections": [{"activityTitle": f"🚨 ALERTA {severity.upper()}", "text": message}],
    }
    async with httpx.AsyncClient() as cli:
        await cli.post(webhook_url, json=card, timeout=10.0)
```

Y se llama desde `notify-console` en el pipeline cuando la municipalidad tiene el webhook configurado.

## Costos

Microsoft Entra External ID (versión consumer-facing) tiene **50,000 MAU gratis/mes**. Para municipalidades pequeñas (<50k funcionarios + ciudadanos autenticados) es gratis. Por encima, son ~$0.0325/MAU. Comparado con Auth0 (~$0.10/MAU) es 3× más barato.
