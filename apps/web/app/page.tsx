import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CloudRain, Droplet, MapPin, ShieldAlert, Users } from "lucide-react";

import { api } from "@/lib/api";
import { EarthGlobe } from "@/components/earth-globe";
import { KPICard } from "@/components/kpi-card";
import { SeverityBadge } from "@/components/severity-badge";
import { fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cuencas, alerts] = await Promise.all([api.cuencas(), api.alerts()]);

  const ivcs = await Promise.all(cuencas.map((c) => api.ivc(c.id).catch(() => null)));

  const popAtRisk = ivcs.reduce((acc, i) => acc + (i?.pop_high_risk ?? 0), 0);
  const ivcAvg =
    ivcs.length > 0
      ? ivcs.reduce((acc, i) => acc + (i?.ivc_mean ?? 0), 0) / ivcs.filter(Boolean).length
      : 0;
  const activeAlerts = alerts.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 24 * 3600 * 1000,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <section className="hero-futuristic">
        <div className="flex items-start justify-between flex-wrap gap-6 relative">
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05]">
              Sistema de Alerta
              <br />
              <span className="bg-gradient-to-r from-sky-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Hídrica Oportuna
              </span>
            </h1>
            <p className="text-white/70 mt-5 max-w-2xl text-base md:text-lg leading-relaxed">
              AHORA vigila los ríos del Perú desde satélites y, junto al pronóstico del clima,
              avisa con días de anticipación cuándo una zona puede inundarse o sufrir un huaico.
            </p>
            <Link
              href="/replay"
              className="mt-7 inline-flex items-center gap-2 rounded-md bg-[var(--color-ahora-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3d8f] border border-white/10 shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-0.5"
            >
              Disparar replay histórico
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Globo terrestre 3D · Three.js · apunta a LATAM */}
          <div className="hidden lg:block shrink-0 -mt-8 -mr-4">
            <EarthGlobe size={440} />
          </div>
        </div>
      </section>

      <section className="kpi-grid grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Cuencas monitoreadas"
          value={cuencas.length}
          hint="piloto activo"
          accent="blue"
          icon={<Droplet className="w-7 h-7 text-sky-300 fill-sky-400/40" />}
        />
        <KPICard
          label="Alertas últimas 24h"
          value={activeAlerts.length}
          hint={`${alerts.length} históricas`}
          accent="red"
          icon={<Image src="/icons/siren.png" alt="" width={40} height={40} className="object-contain" />}
        />
        <KPICard
          label="Población en riesgo alto"
          value={fmtNum(popAtRisk)}
          hint="IVC > 60, agregado"
          accent="orange"
          icon={<Image src="/icons/shield.png" alt="" width={40} height={40} className="object-contain" />}
        />
        <KPICard
          label="IVC promedio nacional"
          value={fmtNum(ivcAvg, 1)}
          hint="0–100"
          accent="purple"
          icon={<Image src="/icons/chart.png" alt="" width={40} height={40} className="object-contain" />}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white/90 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Cuencas piloto · click para abrir mapa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cuencas.map((c, i) => (
            <Link
              key={c.id}
              href={`/cuenca/${c.id}`}
              className="group block rounded-lg border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.06] hover:border-blue-400/40 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase text-white/40 tracking-wider">{c.id}</div>
                  <div className="font-semibold text-lg text-white mt-1">{c.nombre}</div>
                  {c.foco && (
                    <div className="text-sm text-white/60">Foco: {c.foco}</div>
                  )}
                </div>
                {ivcs[i] && (
                  <div className="text-right">
                    <div className="text-xs text-white/40">IVC máx</div>
                    <div className="text-2xl font-bold text-amber-300 tabular-nums">
                      {fmtNum(ivcs[i]?.ivc_max, 1)}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {fmtNum(ivcs[i]?.pop_high_risk)} en riesgo
                </span>
                {ivcs[i]?.mock && (
                  <span className="text-amber-400/70 font-mono">mock-data</span>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
                <span className="text-blue-400 font-semibold group-hover:text-blue-300">
                  Abrir mapa interactivo
                </span>
                <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white/90 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Alertas recientes
        </h2>
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center text-white/50">
            <CloudRain className="w-10 h-10 mx-auto mb-3 opacity-50" />
            No hay alertas registradas todavía. Probá un replay desde{" "}
            <Link href="/replay" className="text-blue-400 underline">/replay</Link>.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 5).map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3"
              >
                <SeverityBadge severity={a.severity} animate />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/40 font-mono">
                    {new Date(a.created_at).toLocaleString("es-PE")} · {a.cuenca_id}
                  </div>
                  <pre className="text-sm text-white/90 whitespace-pre-wrap font-sans mt-1 leading-snug">
                    {a.message}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
