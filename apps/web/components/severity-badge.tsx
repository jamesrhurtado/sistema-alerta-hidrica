import { cn } from "@/lib/utils";
import { severityLabel } from "@/lib/utils";

export function SeverityBadge({ severity, animate = false }: { severity: string; animate?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        `severity-${severity}`,
        animate && severity === "extreme" && "pulse-ring",
      )}
    >
      {severityLabel(severity)}
    </span>
  );
}
