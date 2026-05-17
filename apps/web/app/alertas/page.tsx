import { Bell } from "lucide-react";

import { api } from "@/lib/api";
import { SeverityBadge } from "@/components/severity-badge";
import { fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const alerts = await api.alerts();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Bell className="w-7 h-7" /> Historial de alertas
        </h1>
        <span className="text-sm text-white/50 font-mono">{alerts.length} eventos</span>
      </header>

      {alerts.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center text-white/50">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
          Aún no hay alertas. Probá un replay desde{" "}
          <a href="/replay" className="text-blue-400 underline">/replay</a>.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start gap-4">
                <SeverityBadge severity={a.severity} animate />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 font-mono mb-2">
                    <span>{new Date(a.created_at).toLocaleString("es-PE")}</span>
                    <span>cuenca: {a.cuenca_id}</span>
                    <span>lluvia 24h: {a.rain_mm_24h?.toFixed(0) ?? "—"} mm</span>
                    <span>IVC máx: {a.ivc_max?.toFixed(1) ?? "—"}</span>
                    <span>población: {fmtNum(a.pop_estimated)}</span>
                  </div>
                  <pre className="text-sm text-white/90 whitespace-pre-wrap font-sans leading-snug">
                    {a.message}
                  </pre>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
