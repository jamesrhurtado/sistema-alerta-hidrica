-- AHORA — esquema inicial (Postgres + PostGIS)
-- Ejecutado automáticamente por docker-entrypoint-initdb.d al levantar el container.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────
-- Catálogo: cuencas piloto y casos emblemáticos
-- ─────────────────────────────────────────────────────────
CREATE TABLE cuenca (
  id          TEXT PRIMARY KEY,                        -- "rimac", "piura", "chillon"
  nombre      TEXT NOT NULL,
  foco        TEXT,                                    -- "Chosica", "Catacaos"
  centro      GEOMETRY(Point, 4326) NOT NULL,
  zoom        SMALLINT NOT NULL DEFAULT 12,
  geom_aoi    GEOMETRY(Polygon, 4326),                 -- buffer del centro o polígono real
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE case_study (
  id          TEXT PRIMARY KEY,                        -- "chosica-pedregal"
  nombre      TEXT NOT NULL,
  cuenca_id   TEXT REFERENCES cuenca(id),
  lon         DOUBLE PRECISION NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  zoom        SMALLINT NOT NULL DEFAULT 13,
  descripcion TEXT
);

CREATE TABLE enso_event (
  year        SMALLINT PRIMARY KEY,
  tipo        TEXT NOT NULL                            -- "El Niño Costero", "La Niña", etc.
);

-- ─────────────────────────────────────────────────────────
-- Datos meteorológicos
-- ─────────────────────────────────────────────────────────
CREATE TABLE rain_daily (
  cuenca_id   TEXT NOT NULL REFERENCES cuenca(id),
  fecha       DATE NOT NULL,
  fuente      TEXT NOT NULL,                            -- "chirps" | "gfs" | "replay"
  mm_24h_mean DOUBLE PRECISION NOT NULL,
  mm_24h_max  DOUBLE PRECISION,
  meta        JSONB,
  PRIMARY KEY (cuenca_id, fecha, fuente)
);

-- Umbral climatológico p95 por cuenca (climatología 1981-2020)
CREATE TABLE rain_threshold (
  cuenca_id   TEXT PRIMARY KEY REFERENCES cuenca(id),
  p95_mm_24h  DOUBLE PRECISION NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- IVC: cache de cómputos pesados de GEE
-- ─────────────────────────────────────────────────────────
CREATE TABLE ivc_run (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenca_id   TEXT NOT NULL REFERENCES cuenca(id),
  params_hash TEXT NOT NULL,                            -- hash de (year_water_*, slope_max, etc.)
  params      JSONB NOT NULL,
  ivc_mean    DOUBLE PRECISION,
  ivc_max     DOUBLE PRECISION,
  pop_high_risk INTEGER,                                -- hab. con IVC > 60
  area_urb_inund_ha DOUBLE PRECISION,
  tile_url    TEXT,                                    -- ruta a PNG en LOCAL_STORAGE_DIR
  geotiff_url TEXT,                                    -- ruta al COG
  status      TEXT NOT NULL DEFAULT 'pending',         -- pending|running|ready|error
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  UNIQUE (cuenca_id, params_hash)
);

-- ─────────────────────────────────────────────────────────
-- Orquestador local (step runner sobre Postgres)
-- ─────────────────────────────────────────────────────────
CREATE TABLE workflow_run (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline    TEXT NOT NULL,                            -- "monitor" | "replay"
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',         -- pending|running|success|failed
  error       TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE workflow_step (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES workflow_run(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  idx         INTEGER NOT NULL,                         -- orden dentro del run
  attempt     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',         -- pending|running|success|failed|skipped
  input       JSONB,
  output      JSONB,
  error       TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE (run_id, step_name)
);

CREATE INDEX idx_workflow_step_run ON workflow_step (run_id, idx);

-- ─────────────────────────────────────────────────────────
-- Eventos de alerta y notificaciones
-- ─────────────────────────────────────────────────────────
CREATE TABLE alert_event (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID REFERENCES workflow_run(id),
  cuenca_id   TEXT NOT NULL REFERENCES cuenca(id),
  severity    TEXT NOT NULL,                            -- "low" | "medium" | "high" | "extreme"
  message     TEXT NOT NULL,
  area        GEOMETRY(MultiPolygon, 4326),
  pop_estimated INTEGER,
  rain_mm_24h DOUBLE PRECISION,
  ivc_max     DOUBLE PRECISION,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_event_cuenca_time ON alert_event (cuenca_id, created_at DESC);

-- Suscriptores de prueba (zonas geográficas)
CREATE TABLE subscriber (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT,
  telefono    TEXT NOT NULL,
  email       TEXT,
  zona        GEOMETRY(Point, 4326),                   -- ubicación del residente
  rol         TEXT NOT NULL DEFAULT 'residente',       -- "residente" | "autoridad"
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outbox de SMS simulados (idempotente por (event_id, telefono))
CREATE TABLE sms_outbox (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES alert_event(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES subscriber(id),
  telefono    TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',          -- queued|sent|failed
  sent_at     TIMESTAMPTZ,
  UNIQUE (event_id, telefono)
);

CREATE INDEX idx_sms_outbox_status ON sms_outbox (status, sent_at DESC);
