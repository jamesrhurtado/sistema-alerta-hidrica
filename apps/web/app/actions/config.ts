"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";

export async function updateMunicipalityWhatsApp(
  municipalityId: string,
  whatsappUrl: string,
) {
  await api.updateMunicipalityConfig(municipalityId, {
    whatsapp_kapso_url: whatsappUrl || null,
  });
  revalidatePath("/configuracion");
}
