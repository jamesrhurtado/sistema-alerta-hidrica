import { notFound } from "next/navigation";
import { Activity, AlertTriangle, MapPin, Users } from "lucide-react";

import { api } from "@/lib/api";
import { RiskMap } from "@/components/risk-map";
import { CuencaStats } from "@/components/cuenca-stats";
import { ForecastCard } from "@/components/forecast-card";
import { IvcExplainer } from "@/components/ivc-explainer";
import { SeverityBadge } from "@/components/severity-badge";
import { fmtNum } from "@/lib/utils";
import { getCurrentMunicipality } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export default async function CuencaPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  let cuenca;
  try {
    cuenca = await api.cuenca(slug);
  } catch {
    notFound();
  }

  const [stack, alerts, cases, muni] = await Promise.all([
    api.layers(slug),
    api.alerts(slug),
    api.caseStudies(slug),
    getCurrentMunicipality(),
  ]);

  const aoiGeom = cuenca.aoi_geojson ? JSON.parse(cuenca.aoi_geojson) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/40 font-mono">
            cuenca · {cuenca.id}
          </div>
          <h1 className="text-3xl font-bold text-white">{cuenca.nombre}</h1>
          {cuenca.foco && (
            <p className="text-white/60 flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" /> Foco: {cuenca.foco}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {stack.mock ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-mono text-amber-300">
              <AlertTriangle className="w-3 h-3" /> modo mock — sin GEE
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-mono text-emerald-300">
              ● Earth Engine en vivo · {Object.keys(stack.layers).length} capas
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RiskMap
            center={stack.center}
            zoom={cuenca.zoom}
            aoiGeoJson={aoiGeom}
            layers={stack.layers}
            totalYears={stack.total_years}
            yearUrbStart={stack.year_urb_start}
            yearUrbEnd={stack.year_urb_end}
            markers={cases.map((c) => ({
              lon: c.lon,
              lat: c.lat,
              label: c.nombre,
              color: "#fde047",
            }))}
            height={620}
          />
          <div className="text-xs text-white/40 mt-2">
            Capas raster servidas por Google Earth Engine (tile XYZ dinámico). Tocá los
            checkboxes de la esquina superior izquierda para apilar/quitar capas.
            La línea amarilla punteada es el AOI (15 km del foco).
          </div>
        </div>

        <aside className="space-y-4">
          <ForecastCard cuencaId={slug} municipalityId={muni?.id} />

          <CuencaStats stack={stack} />

          <IvcExplainer />

          <div>
            <h3 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-2 flex items-center gap-1">
              <Activity className="w-4 h-4" /> Alertas en esta cuenca
            </h3>
            {alerts.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
                Sin alertas. Dispará un replay desde /replay.
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 4).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-xs text-white/40 font-mono">
                        {new Date(a.created_at).toLocaleDateString("es-PE")}
                      </span>
                    </div>
                    <div className="text-white/70 text-xs">
                      lluvia: {a.rain_mm_24h?.toFixed(0) ?? "—"} mm · pop: {fmtNum(a.pop_estimated)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" /> Casos emblemáticos
            </h3>
            {cases.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
                Sin casos asociados.
              </div>
            ) : (
              <ul className="space-y-1">
                {cases.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm"
                  >
                    <div className="font-semibold text-white/90">{c.nombre}</div>
                    {c.descripcion && (
                      <div className="text-xs text-white/50 mt-1">{c.descripcion}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
