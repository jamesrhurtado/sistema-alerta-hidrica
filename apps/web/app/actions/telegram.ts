"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";

export async function setTelegramChannel(
  municipalityId: string,
  chatId: string,
  username: string,
  customBotToken?: string,
) {
  await api.setTelegramChannel(municipalityId, {
    telegram_chat_id: chatId || undefined,
    telegram_username: username || undefined,
    // Si llega vacio, se envia "" para limpiar (volver al bot del sistema)
    telegram_bot_token: customBotToken,
  });
  revalidatePath("/configuracion");
}

export async function testTelegram(municipalityId: string) {
  return api.testTelegram(municipalityId);
}

export async function fireTestAlert(municipalityId: string) {
  return api.fireTestAlert(municipalityId);
}
