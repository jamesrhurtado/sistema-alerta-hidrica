import { MessageSquare } from "lucide-react";

import { api } from "@/lib/api";
import { OutboxLive } from "@/components/outbox-live";

export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  const outbox = await api.outbox();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-7 h-7" /> Bandeja simulada de SMS
        </h1>
        <p className="text-white/60 mt-1 max-w-2xl">
          Cada vez que el pipeline emite una alerta, se encola un SMS por suscriptor
          dentro del polígono afectado. Acá ves exactamente el texto que recibiría
          un teléfono real. En producción se cambia el adaptador a Twilio o Azure
          Communication Services sin modificar la lógica.
        </p>
      </header>

      <OutboxLive initial={outbox} />
    </div>
  );
}
