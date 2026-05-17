"use client";

import { useEffect, useState } from "react";
import { CloudRain, Loader2, Play, TrendingUp } from "lucide-react";

import { api, type ForecastResult } from "@/lib/api";
import { cn, fmtNum } from "@/lib/utils";
import { SeverityBadge } from "./severity-badge";

type Props = { cuencaId: string };

const SEVERITY_BG: Record<string, string> = {
  low:     "border-emerald-500/30 bg-emerald-500/5",
  medium:  "border-amber-500/30 bg-amber-500/5",
  high:    "border-orange-500/30 bg-orange-500/5",
  extreme: "border-red-500/40 bg-red-500/10",
};

export function ForecastCard({ cuencaId }: Props) {
  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api.forecast(cuencaId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [cuencaId]);

  async function analyzeNow() {
    setAnalyzing(true);
    setResult(null);
    try {
      const r = await api.analyzeNow(cuencaId);
      if (!r.ok) {
        setResult(`✖ ${r.error ?? "fallo"}`);
      } else if (r.alert_created) {
        setResult(`🚨 Alerta ${r.severity?.toUpperCase()} disparada. Canales notificados: ${r.telegram_channels_notified}`);
      } else if (r.trigger_active) {
        setResult(`⚠ Umbral superado pero no se creo alerta (revisa logs)`);
      } else {
        setResult(`✓ Todo en orden. Lluvia pronosticada bajo el umbral.`);
      }
      // refresh forecast
      api.forecast(cuencaId).then(setData);
    } catch (err) {
      setResult(`✖ ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando pronostico GFS...
      </div>
    );
  }
  if (!data) return null;

  const sev = data.severity_predicted;
  const ratio = data.ratio_over_threshold;

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", SEVERITY_BG[sev] || SEVERITY_BG.low)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50 flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5" /> Pronostico GFS proximas 48h
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-white">
            {fmtNum(data.forecast_48h.mm_24h_max, 1)} mm
            <span className="text-sm font-normal text-white/50 ml-2">/ 24h máx</span>
          </div>
        </div>
        <SeverityBadge severity={sev} animate={sev === "extreme"} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-black/30 p-2">
          <div className="text-white/40">Umbral local (p95)</div>
          <div className="text-white font-semibold tabular-nums">{fmtNum(data.p95_threshold_mm, 1)} mm</div>
        </div>
        <div className="rounded-md bg-black/30 p-2">
          <div className="text-white/40">Ratio sobre umbral</div>
          <div className={cn("font-semibold tabular-nums", ratio >= 2 ? "text-red-400" : ratio >= 1 ? "text-amber-300" : "text-emerald-400")}>
            {ratio.toFixed(2)}x
          </div>
        </div>
      </div>

      {data.chirps_recent_days.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Lluvia ultima semana (CHIRPS)
          </div>
          <div className="flex items-end gap-0.5 h-12">
            {data.chirps_recent_days.map((d, i) => {
              const h = Math.min(100, (d.mm_24h_max / Math.max(data.p95_threshold_mm * 1.5, 5)) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      "w-full rounded-t",
                      d.mm_24h_max > data.p95_threshold_mm ? "bg-red-500/70" : "bg-blue-500/40",
                    )}
                    style={{ height: `${h}%` }}
                    title={`${d.fecha}: ${d.mm_24h_max.toFixed(1)} mm`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={analyzeNow}
        disabled={analyzing}
        className={cn(
          "w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white",
          "hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {analyzing ? "Analizando..." : "Analizar y alertar si corresponde"}
      </button>

      {result && (
        <div className="text-xs font-mono p-2 rounded-md bg-black/30 border border-white/10 text-white/80">
          {result}
        </div>
      )}

      <div className="text-[10px] text-white/40 leading-relaxed">
        GFS se actualiza cada 6h. Si el maximo en 24h supera el percentil 95 historico
        local, se dispara alerta a los canales Telegram de las municipalidades de esta cuenca.
      </div>
    </div>
  );
}
