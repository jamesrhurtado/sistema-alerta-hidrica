-- Migración 002: canales de Telegram por municipalidad.
-- Mucho más simple que WhatsApp/Kapso: una municipalidad = un canal Telegram.
-- Los residentes se suscriben uniéndose al canal (no necesitamos opt-in individual).

ALTER TABLE municipality
  ADD COLUMN IF NOT EXISTS telegram_chat_id  TEXT,   -- "-1001234567890" o "@ahora_chosica"
  ADD COLUMN IF NOT EXISTS telegram_username TEXT;   -- "ahora_chosica" para generar link t.me/...
