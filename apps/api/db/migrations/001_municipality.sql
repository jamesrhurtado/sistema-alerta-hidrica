-- Migración 001: modelo de municipalidad
-- Aplicar manualmente: pnpm db:psql -f /apps/api/db/migrations/001_municipality.sql
-- O, para repo limpio: pnpm db:reset (esto se ejecuta automáticamente como seed).

CREATE TABLE IF NOT EXISTS municipality (
  id          TEXT PRIMARY KEY,                  -- "chosica", "lima-metro"
  nombre      TEXT NOT NULL,
  parent_id   TEXT REFERENCES municipality(id),  -- jerarquía (Chosica ⊂ Lima)
  nivel       TEXT NOT NULL DEFAULT 'distrital', -- "regional" | "provincial" | "distrital"
  logo_url    TEXT,
  domain_hint TEXT,                              -- ej: "munichosica.gob.pe" para auto-detect en MS auth
  teams_webhook_url TEXT,                        -- canal de MS Teams para alertas (opcional)
  whatsapp_kapso_url TEXT,                       -- link de opt-in de WhatsApp (Kapso)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS municipality_cuenca (
  municipality_id TEXT NOT NULL REFERENCES municipality(id) ON DELETE CASCADE,
  cuenca_id       TEXT NOT NULL REFERENCES cuenca(id) ON DELETE CASCADE,
  PRIMARY KEY (municipality_id, cuenca_id)
);

-- Asociación de suscriptores a una municipalidad (para filtrar opt-in)
ALTER TABLE subscriber
  ADD COLUMN IF NOT EXISTS municipality_id TEXT REFERENCES municipality(id),
  ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'sms',  -- "sms" | "whatsapp" | "teams"
  ADD COLUMN IF NOT EXISTS opt_in_at TIMESTAMPTZ;
