import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2, ExternalLink, Send, Settings } from "lucide-react";

import { api } from "@/lib/api";
import { getCurrentMunicipality } from "@/lib/session";
import { setTelegramChannel } from "@/app/actions/telegram";
import { TelegramActionButtons } from "@/components/telegram-action-buttons";
import { CopyLink } from "@/components/copy-link";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const muni = await getCurrentMunicipality();
  if (!muni) {
    redirect("/login");
  }

  const [tgStatus, tgChats, system, scheduler] = await Promise.all([
    api.telegramStatus(),
    api.telegramRecentChats().catch(() => ({ configured: false, chats: [] })),
    api.systemConfig(),
    api.schedulerStatus(),
  ]);

  const hasToken = tgStatus.configured;
  const botReachable = tgStatus.reachable === true;
  const muniHasChannel = Boolean(muni.telegram_chat_id);
  const channelLink = muni.telegram_username ? `https://t.me/${muni.telegram_username}` : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Settings className="w-7 h-7" /> Configuracion
        </h1>
        <p className="text-white/60 mt-1">
          Panel de la {muni.nombre}. Aqui configuras el canal de Telegram donde llegaran las alertas.
        </p>
      </header>

      {/* Estado del bot Telegram */}
      <section className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" /> Bot de Telegram
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Un solo bot maneja las alertas de todas las municipalidades. Cada una elige a que canal/grupo postear.
            </p>
          </div>
          {hasToken && botReachable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Bot conectado
            </span>
          ) : hasToken ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-semibold">
              <AlertCircle className="w-3 h-3" /> Token invalido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300 font-semibold">
              <AlertCircle className="w-3 h-3" /> Sin token
            </span>
          )}
        </div>
        {hasToken && botReachable && (
          <div className="rounded-md bg-black/30 border border-white/10 p-3 space-y-1">
            <div className="text-xs text-white/50">Tu bot:</div>
            <div className="font-mono text-sm text-blue-300">
              @{tgStatus.bot_username} — {tgStatus.bot_name}
            </div>
            {tgStatus.bot_username && (
              <a
                href={`https://t.me/${tgStatus.bot_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
              >
                Abrir en Telegram <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </section>

      {/* Setup del bot si no esta */}
      {!hasToken && (
        <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Activar el bot de Telegram (2 minutos)
          </h2>
          <ol className="text-xs text-amber-100/85 leading-relaxed space-y-2 list-decimal pl-5">
            <li>Abre Telegram, busca <code className="bg-black/40 px-1 rounded">@BotFather</code> y dile <code className="bg-black/40 px-1 rounded">/newbot</code></li>
            <li>Elige un <strong>nombre</strong> (ej. "AHORA Alertas") y un <strong>username</strong> que termine en <code className="bg-black/40 px-1 rounded">_bot</code> (ej. <code className="bg-black/40 px-1 rounded">ahora_alertas_bot</code>)</li>
            <li>BotFather te entrega un <strong>token</strong> que se ve asi: <code className="bg-black/40 px-1 rounded">123456789:AAH...abc</code></li>
            <li>Pega el token en <code className="bg-black/40 px-1 rounded">apps/api/.env</code>:
              <pre className="bg-black/40 p-2 rounded mt-1 text-[11px] overflow-x-auto">TELEGRAM_BOT_TOKEN=123456789:AAH...abc</pre>
            </li>
            <li>Reinicia el backend (<code className="bg-black/40 px-1 rounded">pnpm api:dev</code>) y refresca esta pagina</li>
          </ol>
        </section>
      )}

      {/* Canal de la municipalidad */}
      {hasToken && botReachable && (
        <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Canal de {muni.nombre}</h2>
            <p className="text-sm text-white/60 mt-1">
              Donde el bot postea las alertas. Puede ser tu propio chat con el bot
              (para pruebas) o un canal/grupo publico (para residentes).
            </p>
          </div>

          {/* Discovery: chats recientes */}
          {tgChats.chats.length > 0 && (
            <div className="rounded-md bg-black/30 border border-white/10 p-3 space-y-2">
              <div className="text-xs text-white/50">
                Chats donde @{tgStatus.bot_username} ha interactuado recientemente:
              </div>
              <div className="space-y-1">
                {tgChats.chats.map((c) => (
                  <div key={c.chat_id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <code className="text-emerald-300">{c.chat_id}</code>
                      <span className="text-white/40 ml-2">
                        {c.type} · {c.title || c.username || c.first_name || ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-white/40">
                Tip: copia el <code>chat_id</code> de tu chat/canal y pegalo abajo.
              </div>
            </div>
          )}

          <form
            action={async (formData: FormData) => {
              "use server";
              await setTelegramChannel(
                muni.id,
                String(formData.get("telegram_chat_id") ?? ""),
                String(formData.get("telegram_username") ?? ""),
              );
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="block text-xs text-white/60">
                Chat ID (puede ser tu user_id, group_id o el handle del canal)
              </label>
              <input
                type="text"
                name="telegram_chat_id"
                defaultValue={muni.telegram_chat_id ?? ""}
                placeholder="123456789 o -1001234567890 o @ahora_chosica"
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/50"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-white/60">
                Username del canal publico (opcional, para mostrar link a residentes)
              </label>
              <input
                type="text"
                name="telegram_username"
                defaultValue={muni.telegram_username ?? ""}
                placeholder="ahora_chosica"
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/50"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2"
            >
              Guardar canal
            </button>
          </form>

          {muniHasChannel && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="text-xs text-white/60">
                Canal actual: <code className="text-emerald-300">{muni.telegram_chat_id}</code>
              </div>

              {channelLink && (
                <div className="rounded-md border border-white/10 bg-black/30 p-3 space-y-2">
                  <div className="text-xs text-white/50">
                    Link publico que compartes con tus residentes:
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-emerald-300 break-all">{channelLink}</code>
                    <CopyLink value={channelLink} />
                    <a
                      href={channelLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-[11px] text-white/40">
                    Quien abre este link y aprieta "Unirse" recibira automaticamente todas las alertas.
                  </p>
                </div>
              )}

              <TelegramActionButtons municipalityId={muni.id} canFire={hasToken && botReachable} />
            </div>
          )}
        </section>
      )}

      {/* Monitor automatico */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white/90">⏱️ Monitor automatico</h2>
        <p className="text-xs text-white/60 leading-relaxed">
          El sistema revisa el pronostico GFS de cada cuenca cada{" "}
          <strong>{scheduler.interval_minutes > 0 ? `${scheduler.interval_minutes} minutos` : "(desactivado en dev)"}</strong>.
          Si la lluvia esperada supera el percentil 95 historico local, dispara una alerta al canal Telegram automaticamente.
        </p>
        <ul className="text-[11px] text-white/50 space-y-1 pl-4 list-disc">
          <li><strong>GFS (pronostico):</strong> se actualiza cada 6 horas — chequeamos cada hora para captar cambios</li>
          <li><strong>CHIRPS (lluvia real):</strong> diario, con 2 dias de delay — usado para calibrar umbrales</li>
          <li><strong>Mapa IVC (vulnerabilidad):</strong> estructural, se recalcula mensualmente</li>
          <li><strong>Sentinel-1 (radar post-evento):</strong> para analisis de daño real, no para alerta proactiva</li>
        </ul>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Estado" value={scheduler.enabled ? "Activo" : "Desactivado"} />
          <Stat label="Intervalo" value={`${scheduler.interval_minutes} min`} />
          <Stat label="Ultima alerta" value={String(scheduler.alerts_triggered)} />
        </div>
        <p className="text-[11px] text-white/40">
          Para activarlo cambia <code>MONITOR_INTERVAL_MINUTES=60</code> en <code>apps/api/.env</code> y reinicia el backend. En produccion (Azure) esto se reemplaza por un Timer Trigger.
        </p>
      </section>

      <Link
        href="/admin/outbox"
        className="block text-xs text-white/40 text-center hover:text-white/60"
      >
        Tip: tambien puedes ver las alertas simuladas en /admin/outbox →
      </Link>
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
