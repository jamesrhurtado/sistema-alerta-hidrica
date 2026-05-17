/**
 * Mock-auth: la municipalidad "logueada" vive en una cookie httpOnly=false
 * para que el frontend la pueda leer también. En producción se reemplaza por
 * Microsoft Entra OAuth (ver docs/MS_AUTH.md).
 */
import { cookies } from "next/headers";

import { api, type Municipality } from "./api";

const COOKIE_NAME = "ahora_municipality";

export async function getCurrentMunicipalityId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

export async function getCurrentMunicipality(): Promise<Municipality | null> {
  const id = await getCurrentMunicipalityId();
  if (!id) return null;
  try {
    return await api.municipality(id);
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
