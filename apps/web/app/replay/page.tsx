import { History } from "lucide-react";

import { api } from "@/lib/api";
import { ReplayButton } from "@/components/replay-button";

export const dynamic = "force-dynamic";

export default async function ReplayPage() {
  const events = await api.replayEvents();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <History className="w-7 h-7" /> Replay histórico
        </h1>
        <p className="text-white/60 mt-1 max-w-2xl">
          Reproduce un evento extremo del pasado y ejecuta el pipeline completo
          (monitoreo → riesgo → notificación). Las alertas y SMS se generan en vivo
          y aparecen en{" "}
          <a href="/alertas" className="text-blue-400 underline">
            /alertas
          </a>{" "}
          y{" "}
          <a href="/admin/outbox" className="text-blue-400 underline">
            /admin/outbox
          </a>
          .
        </p>
      </header>

      <section className="space-y-3">
        {events.map((e) => (
          <ReplayButton key={e.id} event={e} />
        ))}
      </section>

      <section className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-200">
        💡 El pipeline ejecuta steps: <span className="font-mono">load-event → load-cuenca →
        inject-rain → load-ivc → persist-event → notify-console</span>. Cada step
        persiste su estado en Postgres con retries automáticos — si lo cortás a
        mitad, retoma desde donde quedó.
      </section>
    </div>
  );
}
