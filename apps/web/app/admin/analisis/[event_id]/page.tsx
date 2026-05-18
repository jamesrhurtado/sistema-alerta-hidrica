import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, Droplets, Home, Users } from "lucide-react";

import { api } from "@/lib/api";
import { AnalysisMap } from "@/components/analysis-map";
import { fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalisisDetalle({
  params,
}: {
  params: Promise<{ event_id: string }>;
}) {
  const { event_id } = await params;
  let a;
  try {
    a = await api.analysis(event_id);
  } catch {
    notFound();
  }

  const popAfectada = a.stats.pop_afectada;
  const haUrbano = a.stats.ha_urbano_inundado;
  const haTotal = a.stats.ha_inundadas;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/admin/analisis"
        className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a eventos
      </Link>

      <header className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-purple-300/80 font-mono">
          análisis · {a.event_id}
        </div>
        <h1 className="text-3xl font-bold text-white">{a.label}</h1>
        <p className="text-white/60">{a.damage_summary}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          icon={<Droplets className="w-4 h-4" />}
          label="Área inundada (real)"
          value={`${fmtNum(haTotal, 1)} ha`}
          hint="Detectada por radar Sentinel-1"
          accent="text-cyan-300"
        />
        <Stat
          icon={<Home className="w-4 h-4" />}
          label="Zona urbana inundada"
          value={`${fmtNum(haUrbano, 1)} ha`}
          hint="Intersección con manchas urbanas"
          accent="text-pink-400"
        />
        <Stat
          icon={<Users className="w-4 h-4" />}
          label="Población afectada"
          value={fmtNum(popAfectada)}
          hint="Estimación GHSL en zona inundada"
          accent="text-red-400"
        />
        <Stat
          icon={<Clock className="w-4 h-4" />}
          label="Anticipación que AHORA habría dado"
          value={`${a.alert_lead_hours} h`}
          hint="Detección de lluvia anómala vía CHIRPS+GFS"
          accent="text-amber-300"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-white/50 font-semibold">
            Inundación detectada por radar Sentinel-1
          </h2>
          <AnalysisMap analysis={a} />
          <div className="text-xs text-white/40">
            El radar SAR ve a través de las nubes y detecta donde había tierra antes
            y agua después. La capa magenta es la intersección con áreas urbanas:
            ahí donde las viviendas se inundaron.
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4 space-y-2">
            <div className="text-sm font-semibold text-emerald-200 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Si AHORA hubiera estado activo
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Con la lluvia anómala detectada por CHIRPS/GFS, el sistema habría
              disparado una alerta a Defensa Civil y a los residentes suscritos con
              <strong> {a.alert_lead_hours} horas de anticipación</strong>.
            </p>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Con ese tiempo, se podrían haber evacuado a las{" "}
              <strong>{fmtNum(popAfectada)} personas</strong> que quedaron en zona
              inundada — o al menos a la fracción más vulnerable (niños, adultos
              mayores, embarazadas en quebradas).
            </p>
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 space-y-2">
            <div className="text-sm font-semibold text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Daño real registrado
            </div>
            <p className="text-xs text-amber-100/90 leading-relaxed">
              {a.damage_summary}
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-2 text-xs text-white/60">
            <div className="text-sm font-semibold text-white/80">Metodología</div>
            <ul className="space-y-1 list-disc pl-4">
              <li>Pre-evento: mediana Sentinel-1 VH descendente, {a.pre_dates[0]} a {a.pre_dates[1]}</li>
              <li>Post-evento: misma mediana, {a.post_dates[0]} a {a.post_dates[1]}</li>
              <li>Umbral inundación: post &lt; −17 dB y (pre − post) &gt; 3 dB</li>
              <li>Población: GHSL Pop al año más cercano (resolución 100 m)</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Stat({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className={`flex items-center gap-1.5 ${accent}`}>
        {icon}
        <span className="text-xs uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[11px] text-white/40 mt-1 leading-snug">{hint}</div>
    </div>
  );
}
