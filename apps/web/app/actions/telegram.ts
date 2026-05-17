"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";

export async function setTelegramChannel(
  municipalityId: string,
  chatId: string,
  username: string,
) {
  await api.setTelegramChannel(municipalityId, {
    telegram_chat_id: chatId || undefined,
    telegram_username: username || undefined,
  });
  revalidatePath("/configuracion");
}

export async function testTelegram(municipalityId: string) {
  return api.testTelegram(municipalityId);
}

export async function fireTestAlert(municipalityId: string) {
  return api.fireTestAlert(municipalityId);
}
