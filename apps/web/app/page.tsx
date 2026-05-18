import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CloudRain,
  MapPin,
  Satellite,
  ShieldCheck,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.3) 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300 mb-6">
            🇵🇪 Hackatón Perú · Sistema de alerta temprana
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            AHORA
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-white/80 max-w-2xl mx-auto">
            Sistema de Alerta Hídrica Oportuna con Respuesta Anticipada
          </p>
          <p className="mt-4 text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Combina geointeligencia satelital con pronósticos meteorológicos
            para que cada gobierno local anticipe inundaciones y huaicos
            con horas de ventaja.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all"
            >
              Ingresar como municipalidad
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#caracteristicas"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 hover:bg-white/5 px-5 py-3 text-sm font-semibold text-white/80"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>
      </section>

      {/* Stats reales */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat number="502" label="habitantes en riesgo alto en Chosica" />
          <Stat number="18h" label="de anticipación con datos satelitales" />
          <Stat number="34.8 ha" label="de invasiones detectadas sobre quebradas" />
          <Stat number="cada 6h" label="actualización del pronóstico GFS" />
        </div>
      </section>

      {/* Tres pilares */}
      <section id="caracteristicas" className="max-w-6xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white">Tres herramientas en una</h2>
          <p className="mt-2 text-white/60">
            AHORA da a la municipalidad lo que necesita para actuar
            <strong className="text-white"> antes</strong>,
            <strong className="text-white"> durante</strong> y
            <strong className="text-white"> después</strong> de cada emergencia hídrica.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Pillar
            icon={<MapPin className="w-6 h-6" />}
            color="text-orange-400"
            tag="Antes"
            title="Mapa de riesgo estructural"
            desc="Identifica invasiones sobre quebradas y zonas de alta vulnerabilidad. La base para fiscalizar construcciones y planificar reubicación."
            data="Google Earth Engine · JRC GSW · GHSL · HydroSHEDS · SRTM"
          />
          <Pillar
            icon={<CloudRain className="w-6 h-6" />}
            color="text-blue-400"
            tag="Durante"
            title="Alerta por pronóstico GFS"
            desc="Cada hora compara la lluvia esperada contra el umbral histórico de cada cuenca. Si supera el umbral, dispara alerta a Telegram automáticamente."
            data="NOAA GFS · CHIRPS · Análisis de percentil 95 local"
          />
          <Pillar
            icon={<Satellite className="w-6 h-6" />}
            color="text-purple-400"
            tag="Después"
            title="Análisis con radar"
            desc="Mide el daño real de cada evento con radar Sentinel-1 (ve a través de nubes). Permite validar predicciones y justificar inversión."
            data="Sentinel-1 SAR · GHSL Pop · Reducciones por cuenca"
          />
        </div>
      </section>

      {/* Casos reales */}
      <section className="bg-white/[0.02] border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-white text-center">
            Eventos documentados en Perú
          </h2>
          <p className="mt-2 text-center text-white/60 max-w-2xl mx-auto">
            AHORA valida sus predicciones contra los huaicos e inundaciones
            que la historia reciente recuerda.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <CaseCard
              fecha="Marzo 2017"
              titulo="Huaico Chosica"
              detalle="Carretera Central bloqueada 5 días. 6 muertes."
              dato="18h"
              datoLabel="de anticipación"
            />
            <CaseCard
              fecha="Marzo 2017"
              titulo="El Niño Costero (Piura)"
              detalle="Desborde río Piura. 40+ muertes. 200,000 damnificados."
              dato="24h"
              datoLabel="de anticipación"
            />
            <CaseCard
              fecha="Marzo 2023"
              titulo="Ciclón Yaku (Lima)"
              detalle="99 muertes en Perú. 370,000 afectados. 24,400 viviendas colapsadas."
              dato="12h"
              datoLabel="de anticipación"
            />
          </div>
        </div>
      </section>

      {/* Cómo funciona la alerta */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center">
          De los satélites al celular del residente
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4">
          <FlowStep n={1} icon={<Satellite className="w-5 h-5" />} title="Satélites" desc="GFS pronostica lluvia próximas 48h sobre cada cuenca" />
          <FlowStep n={2} icon={<CloudRain className="w-5 h-5" />} title="Análisis" desc="Compara con el percentil 95 histórico local" />
          <FlowStep n={3} icon={<Bell className="w-5 h-5" />} title="Alerta" desc="Si supera el umbral, dispara al canal Telegram" />
          <FlowStep n={4} icon={<Users className="w-5 h-5" />} title="Residentes" desc="Reciben la alerta en su WhatsApp / Telegram" />
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-10 md:p-14">
          <ShieldCheck className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white">
            ¿Eres una municipalidad?
          </h2>
          <p className="mt-3 text-white/70 max-w-xl mx-auto">
            Ingresa para ver el panel de tu jurisdicción: mapa de invasiones
            sobre quebradas, pronóstico en vivo, y configuración del canal
            Telegram que comunica a tus residentes.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20"
          >
            <Building2 className="w-4 h-4" />
            Ingresar como municipalidad
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-white tabular-nums">{number}</div>
      <div className="mt-1 text-xs md:text-sm text-white/50 leading-tight">{label}</div>
    </div>
  );
}

function Pillar({
  icon, color, tag, title, desc, data,
}: {
  icon: React.ReactNode;
  color: string;
  tag: string;
  title: string;
  desc: string;
  data: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${color}`}>
          {tag}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
      <div className="text-[10px] text-white/40 font-mono pt-2 border-t border-white/10">
        {data}
      </div>
    </div>
  );
}

function CaseCard({
  fecha, titulo, detalle, dato, datoLabel,
}: {
  fecha: string;
  titulo: string;
  detalle: string;
  dato: string;
  datoLabel: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{fecha}</div>
      <div className="font-semibold text-white">{titulo}</div>
      <div className="text-sm text-white/60 leading-snug">{detalle}</div>
      <div className="pt-2 border-t border-white/10 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-amber-300 tabular-nums">{dato}</span>
        <span className="text-xs text-white/50">{datoLabel}</span>
      </div>
    </div>
  );
}

function FlowStep({
  n, icon, title, desc,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-2">
      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-blue-500/30">
        {n}
      </div>
      <div className="text-blue-400 flex items-center gap-2">
        {icon}
        <span className="font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-white/60 leading-snug">{desc}</p>
    </div>
  );
}
