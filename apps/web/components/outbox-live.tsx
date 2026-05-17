"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Phone, Radio } from "lucide-react";

import { api, type OutboxItem } from "@/lib/api";
import { SeverityBadge } from "./severity-badge";

export function OutboxLive({ initial }: { initial: OutboxItem[] }) {
  const [items, setItems] = useState<OutboxItem[]>(initial);
  const [streaming, setStreaming] = useState(true);
  const seenIds = useRef(new Set(initial.map((i) => i.id)));

  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(async () => {
      try {
        const fresh = await api.outbox();
        const newOnes = fresh.filter((i) => !seenIds.current.has(i.id));
        if (newOnes.length) {
          for (const i of newOnes) seenIds.current.add(i.id);
          setItems(fresh);
        }
      } catch {
        // silent
      }
    }, 2000);
    return () => clearInterval(id);
  }, [streaming]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Radio className={`w-4 h-4 ${streaming ? "text-emerald-400 animate-pulse" : "text-white/30"}`} />
          {streaming ? "Streaming en vivo (poll 2s)" : "Pausado"}
        </div>
        <button
          onClick={() => setStreaming((s) => !s)}
          className="text-xs px-3 py-1 rounded border border-white/10 hover:bg-white/5"
        >
          {streaming ? "Pausar" : "Reanudar"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center text-white/40">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          No hay SMS en la bandeja. Dispará un replay para generar alertas.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-4 animate-in slide-in-from-left-2"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-white/80">{it.telefono}</span>
                    <SeverityBadge severity={it.severity} />
                    <span className="text-xs text-white/40 font-mono">{it.cuenca_id}</span>
                  </div>
                  <pre className="text-sm text-white/90 whitespace-pre-wrap font-sans leading-snug">{it.body}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
