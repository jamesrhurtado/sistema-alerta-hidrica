-- Seed: cuencas piloto, casos emblemáticos y eventos ENSO.
-- Coordenadas provienen del prototipo AGUA & ASFALTO v3.0 (Code Editor).

-- Cuencas piloto (solo Rímac activa en MVP; otras quedan listas)
INSERT INTO cuenca (id, nombre, foco, centro, zoom, geom_aoi) VALUES
  ('rimac',   'Cuenca del Rímac',   'Chosica',
    ST_SetSRID(ST_MakePoint(-76.69, -11.93), 4326), 13,
    ST_Buffer(ST_SetSRID(ST_MakePoint(-76.69, -11.93), 4326)::geography, 15000)::geometry),
  ('piura',   'Cuenca del Piura',   'Catacaos',
    ST_SetSRID(ST_MakePoint(-80.68, -5.27), 4326), 12,
    ST_Buffer(ST_SetSRID(ST_MakePoint(-80.68, -5.27), 4326)::geography, 15000)::geometry),
  ('chillon', 'Cuenca del Chillón', 'Comas/Carabayllo',
    ST_SetSRID(ST_MakePoint(-77.05, -11.90), 4326), 12,
    ST_Buffer(ST_SetSRID(ST_MakePoint(-77.05, -11.90), 4326)::geography, 15000)::geometry);

-- Casos emblemáticos (replica del prototipo)
INSERT INTO case_study (id, nombre, cuenca_id, lon, lat, zoom, descripcion) VALUES
  ('chosica-pedregal',     'Chosica - Quebrada Pedregal',          'rimac',   -76.69, -11.93, 13, 'Huaicos recurrentes 1987, 2017, 2023'),
  ('catacaos-piura',       'Catacaos (Piura) - El Niño 2017',      'piura',   -80.68,  -5.27, 12, 'Desborde río Piura, >200k damnificados'),
  ('punta-hermosa',        'Punta Hermosa - Huayco 2017',          NULL,      -76.83, -12.33, 13, 'Huaico repentino sobre balneario'),
  ('trujillo-moche',       'Trujillo / Río Moche',                 NULL,      -78.97,  -8.18, 11, NULL),
  ('tumbes-rio',           'Tumbes - Río Tumbes',                  NULL,      -80.45,  -3.57, 11, NULL),
  ('iquitos-amazonia',     'Iquitos - Amazonía',                   NULL,      -73.25,  -3.75, 11, NULL),
  ('pucallpa-ucayali',     'Pucallpa - Río Ucayali',               NULL,      -74.55,  -8.39, 11, NULL),
  ('ica-rio',              'Ica - Río Ica',                        NULL,      -75.73, -14.07, 12, NULL),
  ('mala-canete',          'Mala / Cañete',                        NULL,      -76.63, -12.66, 11, NULL),
  ('lima-norte',           'Lima Norte - Comas/Carabayllo',        'chillon', -77.05, -11.90, 12, NULL),
  ('sjl',                  'San Juan de Lurigancho',               NULL,      -76.97, -11.99, 12, NULL);

-- Eventos ENSO fuertes en Perú (del prototipo)
INSERT INTO enso_event (year, tipo) VALUES
  (1983, 'El Niño fuerte'),
  (1989, 'La Niña'),
  (1998, 'El Niño extraordinario'),
  (2000, 'La Niña'),
  (2011, 'La Niña'),
  (2017, 'El Niño Costero'),
  (2021, 'La Niña triple'),
  (2023, 'El Niño Costero');

-- Suscriptores de prueba — 3 residentes en Chosica + 1 autoridad
INSERT INTO subscriber (nombre, telefono, email, zona, rol) VALUES
  ('Demo Residente A', '+51999000001', NULL,
    ST_SetSRID(ST_MakePoint(-76.692, -11.928), 4326), 'residente'),
  ('Demo Residente B', '+51999000002', NULL,
    ST_SetSRID(ST_MakePoint(-76.701, -11.935), 4326), 'residente'),
  ('Demo Residente C', '+51999000003', NULL,
    ST_SetSRID(ST_MakePoint(-76.685, -11.920), 4326), 'residente'),
  ('Defensa Civil Demo', '+51999000999', 'defensa@example.local',
    ST_SetSRID(ST_MakePoint(-76.690, -11.930), 4326), 'autoridad');

-- Umbral climatológico p95 placeholder para Rímac
-- (en F2 lo recalcula GEE; este valor es para que el pipeline pueda correr en MOCK)
INSERT INTO rain_threshold (cuenca_id, p95_mm_24h) VALUES
  ('rimac',   18.5),
  ('piura',   42.0),
  ('chillon', 15.0);
