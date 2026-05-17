import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2, ExternalLink, MessageCircle, Settings, Webhook } from "lucide-react";

import { api } from "@/lib/api";
import { getCurrentMunicipality } from "@/lib/session";
import { updateMunicipalityWhatsApp } from "@/app/actions/config";
import { CopyLink } from "@/components/copy-link";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const muni = await getCurrentMunicipality();
  if (!muni) {
    redirect("/login");
  }

  const [system, scheduler] = await Promise.all([
    api.systemConfig(),
    api.schedulerStatus(),
  ]);

  const hasKapsoUrl = Boolean(muni.whatsapp_kapso_url);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Settings className="w-7 h-7" /> Configuracion
        </h1>
        <p className="text-white/60 mt-1">
          Panel de la {muni.nombre}. Aqui defines como se entregan las alertas a tus
          residentes y a tu equipo interno.
        </p>
      </header>

      {/* WhatsApp via Kapso */}
      <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              WhatsApp para residentes <span className="text-xs text-emerald-300/80">(Kapso)</span>
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Reparte un link a tus pobladores. Quien lo abre, recibe un asistente
              que pide su ubicacion y consentimiento. Solo quienes vivan en zonas
              cubiertas por tus cuencas recibiran alertas.
            </p>
          </div>
          {system.kapso_configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-semibold">
              <CheckCircle2 className="w-3 h-3" /> API key activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-semibold">
              <AlertCircle className="w-3 h-3" /> Falta API key
            </span>
          )}
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            const url = String(formData.get("whatsapp_kapso_url") ?? "");
            await updateMunicipalityWhatsApp(muni.id, url);
          }}
          className="space-y-2"
        >
          <label className="block text-xs text-white/60">
            Link publico de tu chat Kapso (ej. <code>https://app.kapso.ai/c/abc123</code>)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              name="whatsapp_kapso_url"
              defaultValue={muni.whatsapp_kapso_url ?? ""}
              placeholder="https://app.kapso.ai/c/..."
              className="flex-1 rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/50"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4"
            >
              Guardar
            </button>
          </div>
        </form>

        {hasKapsoUrl && (
          <div className="rounded-md border border-white/10 bg-black/30 p-3 space-y-2">
            <div className="text-xs text-white/50">Link que compartiras con tus pobladores:</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-emerald-300 break-all font-mono">
                {muni.whatsapp_kapso_url}
              </code>
              <CopyLink value={muni.whatsapp_kapso_url!} />
              <a
                href={muni.whatsapp_kapso_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="text-[11px] text-white/40 leading-snug">
              Tip: ponlo en tu pagina web, en redes sociales y en avisos impresos
              que reparte el sereno o el ATM. Cuanto mas residentes opt-in, mas
              cobertura tendran las alertas.
            </div>
          </div>
        )}
      </section>

      {/* Pasos para activar Kapso */}
      {!system.kapso_configured && (
        <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Activar envio real de WhatsApp
          </h2>
          <p className="text-xs text-amber-100/80 leading-relaxed">
            Para que el sistema envie WhatsApp de verdad (no solo simulado), un
            administrador debe configurar el API key de Kapso en el backend.
          </p>
          <ol className="text-xs text-amber-100/80 leading-relaxed space-y-1 list-decimal pl-5">
            <li>Crear cuenta en <a href="https://kapso.ai" target="_blank" rel="noopener noreferrer" className="underline">kapso.ai</a> (free tier alcanza para piloto distrital).</li>
            <li>En el dashboard de Kapso, generar un API key y un webhook secret.</li>
            <li>Configurar el webhook URL: <code className="bg-black/40 px-1 rounded">http://tu-backend/webhooks/kapso</code></li>
            <li>Pegar las credenciales en <code className="bg-black/40 px-1 rounded">apps/api/.env</code>:
              <pre className="bg-black/40 p-2 rounded mt-1 text-[11px] overflow-x-auto">{`KAPSO_API_KEY=k_live_...
KAPSO_WEBHOOK_SECRET=tu-secreto-aleatorio`}</pre>
            </li>
            <li>Reiniciar el backend (<code className="bg-black/40 px-1 rounded">pnpm api:dev</code>).</li>
          </ol>
          <p className="text-xs text-amber-100/80">
            Mientras tanto, el sistema mantiene el simulador y veras los mensajes en{" "}
            <Link href="/admin/outbox" className="underline">/admin/outbox</Link>.
          </p>
        </section>
      )}

      {/* Webhook URL para registrar en Kapso */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Webhook className="w-4 h-4" /> Webhook (para devs)
        </h2>
        <p className="text-xs text-white/60 leading-relaxed">
          Cuando un residente acepta el opt-in en el chat de Kapso, Kapso debe
          notificar a este endpoint. Configuralo en el dashboard de Kapso.
        </p>
        <code className="block bg-black/40 p-2 rounded text-[11px] text-white/80 font-mono">
          POST http://localhost:8000/webhooks/kapso
        </code>
        <p className="text-[11px] text-white/40">
          El payload debe incluir <code>event: "opt_in"</code>,{" "}
          <code>wa_number</code>, <code>ubicacion: {`{lat, lon}`}</code>, y{" "}
          <code>municipality_hint: "{muni.id}"</code>. Detalle en{" "}
          <a href="https://github.com/jamesrhurtado/sistema-alerta-hidrica/blob/main/KAPSO_WHATSAPP.md" target="_blank" rel="noopener noreferrer" className="underline">KAPSO_WHATSAPP.md</a>.
        </p>
      </section>

      {/* Monitor automático */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white/90">⏱️ Monitor automatico</h2>
        <p className="text-xs text-white/60">
          Cada <strong>{scheduler.interval_minutes} minutos</strong>, el sistema
          revisa el pronostico GFS de cada cuenca y dispara alertas si la lluvia
          esperada supera el percentil 95 local.
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Estado" value={scheduler.enabled ? "Activo" : "Apagado"} />
          <Stat
            label="Ultimo escaneo"
            value={
              scheduler.ran_at
                ? new Date(scheduler.ran_at).toLocaleTimeString("es-PE")
                : "—"
            }
          />
          <Stat
            label="Alertas disparadas (sesion)"
            value={String(scheduler.alerts_triggered)}
          />
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Para cambiar el intervalo, edita <code>MONITOR_INTERVAL_MINUTES</code> en{" "}
          <code>apps/api/.env</code> y reinicia el backend. Pon <code>0</code> para
          desactivarlo. En produccion en Azure, este loop se reemplaza por un Timer
          Trigger nativo (mas economico).
        </p>
      </section>

      {/* Suscriptores actuales */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-2">
        <h2 className="text-sm font-semibold text-white/90">👥 Suscriptores activos</h2>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {Object.entries(muni.suscriptores_por_canal ?? {}).length === 0 ? (
            <div className="col-span-3 text-white/40 italic">
              Aun no hay suscriptores. Comparte tu link de Kapso para captar pobladores.
            </div>
          ) : (
            Object.entries(muni.suscriptores_por_canal ?? {}).map(([canal, n]) => (
              <Stat key={canal} label={canal.toUpperCase()} value={String(n)} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-base font-semibold text-white mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
