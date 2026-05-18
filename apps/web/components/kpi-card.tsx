import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "red" | "orange" | "purple" | "amber";
  className?: string;
  icon?: ReactNode;
};

// Valores en tonos brillantes para que destaquen sobre el bg oscuro
const ACCENT_TEXT: Record<NonNullable<Props["accent"]>, string> = {
  blue: "text-sky-300",
  red: "text-red-400",
  orange: "text-orange-400",
  purple: "text-purple-300",
  amber: "text-amber-300",
};

const ACCENT_BAR: Record<NonNullable<Props["accent"]>, string> = {
  blue: "bg-sky-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
};

const ACCENT_GLOW: Record<NonNullable<Props["accent"]>, string> = {
  blue: "shadow-sky-500/20 hover:shadow-sky-500/40",
  red: "shadow-red-500/20 hover:shadow-red-500/40",
  orange: "shadow-orange-500/20 hover:shadow-orange-500/40",
  purple: "shadow-purple-500/20 hover:shadow-purple-500/40",
  amber: "shadow-amber-500/20 hover:shadow-amber-500/40",
};

export function KPICard({ label, value, hint, accent = "blue", className, icon }: Props) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-lg overflow-hidden transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-slate-700 hover:shadow-xl",
        "cursor-default",
        ACCENT_GLOW[accent],
        className,
      )}
    >
      {/* Top accent bar */}
      <div className={cn("absolute top-0 inset-x-0 h-1.5 transition-all duration-300 group-hover:h-2", ACCENT_BAR[accent])} aria-hidden />

      {/* Shine sweep en hover */}
      <div
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
        aria-hidden
      />

      {/* Icon top-right */}
      {icon && (
        <div className="absolute top-4 right-3.5 w-10 h-10 flex items-center justify-center pointer-events-none transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          {icon}
        </div>
      )}

      <div className="relative text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold pr-12 mt-1">
        {label}
      </div>
      <div className={cn("relative mt-2 text-4xl font-bold tabular-nums tracking-tight leading-none", ACCENT_TEXT[accent])}>
        {value}
      </div>
      {hint && <div className="relative mt-2.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
