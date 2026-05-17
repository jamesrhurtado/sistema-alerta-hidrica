import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) {
    // Para conteos esperados (alertas, hab, ha), mostrar 0 es más claro que —.
    // Si necesitas distinguir "sin dato" usar fmtNumOrDash.
    return "0";
  }
  return Number(n).toLocaleString("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtNumOrDash(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return Number(n).toLocaleString("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function severityLabel(s: string): string {
  switch (s) {
    case "extreme":
      return "EXTREMA";
    case "high":
      return "ALTA";
    case "medium":
      return "MEDIA";
    case "low":
      return "BAJA";
    default:
      return s.toUpperCase();
  }
}
