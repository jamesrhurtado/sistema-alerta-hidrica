-- Migración 003: token de bot Telegram por municipalidad
-- Cada muni puede usar el bot del sistema o su propio bot personalizado.

ALTER TABLE municipality
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;  -- NULL = usa TELEGRAM_BOT_TOKEN del sistema
