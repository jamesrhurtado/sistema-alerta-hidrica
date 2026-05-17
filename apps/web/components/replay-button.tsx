"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

import { api, type ReplayEvent } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ReplayButton({ event }: { event: ReplayEvent }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function trigger() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.triggerReplay(event.id);
      if (r.status === "success") {
        setResult("✔ Pipeline completado. Generadas alertas + outbox.");
        // refresh server data
        router.refresh();
      } else {
        setResult(`✖ ${r.error ?? "pipeline falló"}`);
      }
    } catch (err) {
      setResult(`✖ ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-mono text-xs text-white/40">{event.id}</div>
          <div className="mt-1 font-semibold">{event.descripcion}</div>
          <div className="mt-1 text-sm text-white/60">
            {event.fecha} · {event.cuenca_id} · lluvia 24h máx:{" "}
            <span className="text-amber-300 font-semibold">{event.mm_24h_max} mm</span>
          </div>
        </div>
        <button
          onClick={trigger}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-md bg-[var(--color-ahora-blue)] px-4 py-2 text-sm font-semibold text-white shadow",
            "hover:bg-[#0a3d8f] disabled:opacity-50 disabled:cursor-not-allowed",
            "border border-white/10",
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? "Ejecutando..." : "Disparar replay"}
        </button>
      </div>
      {result && (
        <div className={cn("mt-3 text-sm font-mono", result.startsWith("✔") ? "text-emerald-400" : "text-red-400")}>
          {result}
        </div>
      )}
    </div>
  );
}
