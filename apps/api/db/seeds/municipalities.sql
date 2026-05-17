-- Seed: municipalidades piloto para la demo.

INSERT INTO municipality (id, nombre, parent_id, nivel, domain_hint, whatsapp_kapso_url) VALUES
  ('lima-metro',         'Municipalidad Metropolitana de Lima', NULL,         'provincial', 'munlima.gob.pe',     NULL),
  ('chosica',            'Municipalidad de Lurigancho-Chosica', 'lima-metro', 'distrital',  'munichosica.gob.pe', 'https://kapso.ai/chat/REPLACE-WITH-YOUR-LINK'),
  ('piura-prov',         'Municipalidad Provincial de Piura',   NULL,         'provincial', 'munipiura.gob.pe',   NULL),
  ('catacaos',           'Municipalidad Distrital de Catacaos', 'piura-prov', 'distrital',  'municatacaos.gob.pe', NULL)
ON CONFLICT (id) DO NOTHING;

-- Asignación cuencas <-> municipalidades
INSERT INTO municipality_cuenca (municipality_id, cuenca_id) VALUES
  ('chosica',    'rimac'),
  ('lima-metro', 'rimac'),
  ('lima-metro', 'chillon'),
  ('catacaos',   'piura'),
  ('piura-prov', 'piura')
ON CONFLICT DO NOTHING;

-- Re-seedear suscriptores con su municipalidad
UPDATE subscriber SET municipality_id = 'chosica' WHERE telefono LIKE '+5199900000%';
