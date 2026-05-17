import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "red" | "orange" | "purple" | "amber";
  className?: string;
};

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  blue: "text-[var(--color-ahora-blue)] from-[#08306b]/30",
  red: "text-[var(--color-ahora-red)] from-[#b30000]/30",
  orange: "text-[var(--color-ahora-orange)] from-[#cc4c02]/30",
  purple: "text-[var(--color-ahora-purple)] from-[#6a51a3]/30",
  amber: "text-[var(--color-ahora-amber)] from-[#fec44f]/30",
};

export function KPICard({ label, value, hint, accent = "blue", className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-gradient-to-br to-transparent p-4 shadow-sm",
        ACCENT[accent].split(" ")[1],
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className={cn("mt-1 text-3xl font-bold tabular-nums", ACCENT[accent].split(" ")[0])}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </div>
  );
}
