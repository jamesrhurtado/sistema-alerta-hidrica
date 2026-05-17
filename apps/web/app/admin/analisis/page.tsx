import Link from "next/link";
import { ArrowRight, Satellite } from "lucide-react";

import { api } from "@/lib/api";
import { fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalisisPage() {
  const events = await api.analysisEvents();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-wider text-purple-300/80 font-mono mb-1">
          análisis retrospectivo
        </div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Satellite className="w-7 h-7" /> Eventos históricos
        </h1>
        <p className="text-white/60 mt-2 max-w-2xl">
          Estudia eventos extremos pasados con datos reales del radar Sentinel-1.
          Verás el área inundada que dejó cada evento y cuánta anticipación
          AHORA habría dado a las autoridades.
        </p>
      </header>

      <section className="space-y-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/admin/analisis/${e.id}`}
            className="group block rounded-lg border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.06] hover:border-purple-400/40 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-mono text-xs text-white/40">{e.id}</div>
                <div className="mt-1 font-semibold text-white">{e.label}</div>
                <div className="mt-1 text-sm text-white/60">
                  Cuenca: <span className="font-mono">{e.cuenca_id}</span> ·
                  ventana post: {e.post_dates[0]} → {e.post_dates[1]}
                </div>
                <div className="mt-2 text-xs text-white/50 italic">
                  {e.damage_summary}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-white/40">Anticipación</div>
                <div className="text-2xl font-bold text-amber-300 tabular-nums">
                  {fmtNum(e.alert_lead_hours)}<span className="text-sm">h</span>
                </div>
                <div className="text-[10px] text-white/40 mt-2 flex items-center gap-1 justify-end">
                  Analizar
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-200">
        <p className="font-semibold mb-1">💡 ¿Para qué sirve esto?</p>
        <p className="text-blue-100/90 text-xs leading-relaxed">
          Cada análisis cruza el radar Sentinel-1 (que penetra nubes y ve agua bajo la
          tormenta) con los datos de población GHSL para estimar cuántas personas
          quedaron en zona inundada. Es el "después" real del evento.
          Te permite cuantificar el daño que el sistema habría podido evitar y validar
          que las predicciones de AHORA habrían correspondido al evento real.
        </p>
      </section>
    </div>
  );
}
