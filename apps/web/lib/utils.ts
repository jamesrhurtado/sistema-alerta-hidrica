import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
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
