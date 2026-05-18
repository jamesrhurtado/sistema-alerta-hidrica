import Link from "next/link";
import { ArrowRight, Building2, CloudRain, MapPin, ShieldAlert, Users } from "lucide-react";

import { api, type Cuenca } from "@/lib/api";
import { KPICard } from "@/components/kpi-card";
import { SeverityBadge } from "@/components/severity-badge";
import { fmtNum } from "@/lib/utils";
import { getCurrentMunicipality } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const muni = await getCurrentMunicipality();

  // Filtrar cuencas a las que monitorea la municipalidad logueada.
  // Si no hay sesión, mostrar las 3 cuencas piloto del sistema entero.
  let cuencas: Cuenca[];
  if (muni && muni.cuencas) {
    cuencas = muni.cuencas;
  } else {
    cuencas = await api.cuencas();
  }

  const alerts = await api.alerts();
  // Usamos /layers en vez de /ivc para consistencia con la pagina de cuenca.
  // "Pob. en riesgo alto" = personas en polígono de invasiones nuevas sobre cauce.
  const stacks = await Promise.all(cuencas.map((c) => api.layers(c.id).catch(() => null)));

  const popAtRisk = stacks.reduce((acc, s) => acc + (s?.stats.pop_high_risk ?? 0), 0);
  const validStacks = stacks.filter(Boolean);
  const ivcAvg =
    validStacks.length > 0
      ? validStacks.reduce((acc, s) => acc + (s?.stats.ivc_mean ?? 0), 0) / validStacks.length
      : 0;
  const activeAlerts = alerts.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 24 * 3600 * 1000,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <section>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            {muni ? (
              <div className="text-xs uppercase text-emerald-300/80 tracking-wider mb-1 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                {muni.nombre}
              </div>
            ) : (
              <div className="text-xs uppercase text-amber-300/80 tracking-wider mb-1">
                Sin sesión · vista pública
              </div>
            )}
            <h1 className="text-3xl font-bold text-white">
              {muni ? "Panel de monitoreo hídrico" : "Sistema de Alerta Hídrica Oportuna"}
            </h1>
            <p className="text-white/60 mt-1 max-w-2xl">
              {muni
                ? `Monitoreo activo de las cuencas asignadas a ${muni.nombre}. Las alertas se disparan automáticamente cuando el pronóstico supera el umbral crítico de cada cuenca.`
                : "Plataforma de alerta temprana de inundaciones y huaicos para gobiernos locales. Ingresá como municipalidad para ver tu panel."}
            </p>
          </div>
          {!muni && (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-ahora-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3d8f] border border-white/10"
            >
              Ingresar como municipalidad
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Cuencas monitoreadas"
          value={cuencas.length}
          hint={muni ? `asignadas a ${muni.id}` : "piloto del sistema"}
          accent="blue"
        />
        <KPICard
          label="Alertas últimas 24h"
          value={activeAlerts.length}
          hint={`${alerts.length} totales en historia`}
          accent="red"
        />
        <KPICard
          label="Población en riesgo alto"
          value={fmtNum(popAtRisk)}
          hint="invasiones sobre cauce"
          accent="orange"
        />
        <KPICard
          label="IVC promedio"
          value={fmtNum(ivcAvg, 1)}
          hint="vulnerabilidad combinada"
          accent="purple"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white/90 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {muni ? "Tus cuencas · click para abrir el mapa" : "Cuencas piloto del sistema"}
        </h2>
        {cuencas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center text-white/50">
            Esta municipalidad no tiene cuencas asignadas todavía.
          </div>
        ) : (
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
                  {stacks[i] && (
                    <div className="text-right">
                      <div className="text-xs text-white/40">IVC máx</div>
                      <div className="text-2xl font-bold text-amber-300 tabular-nums">
                        {fmtNum(stacks[i]?.stats.ivc_max, 1)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {fmtNum(stacks[i]?.stats.pop_high_risk)} en riesgo
                  </span>
                  {stacks[i]?.mock && (
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
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white/90 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Alertas recientes
        </h2>
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center text-white/50">
            <CloudRain className="w-10 h-10 mx-auto mb-3 opacity-50" />
            No hay alertas registradas todavía.{" "}
            <Link href={{ pathname: "/admin/simulacion" }} className="text-blue-400 underline">
              Simulá un escenario
            </Link>{" "}
            para ver cómo respondería el sistema.
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
