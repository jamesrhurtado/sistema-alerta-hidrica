"use client";

import { Layers } from "lucide-react";
import { useState } from "react";

import type { TileLayer } from "@/lib/api";

type Props = {
  layers: Record<string, TileLayer>;
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
};

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "🚨 Riesgo (principal)", ids: ["ivc", "riesgo_nuevo", "riesgo_antiguo"] },
  { title: "🏞️ Hidrografía", ids: ["rios", "agua_freq"] },
  { title: "🏙️ Urbano", ids: ["urbano_temporal"] },
];

export function LayerControl({ layers, visible, onToggle }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-white/10 bg-black/70 backdrop-blur w-[260px]">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
      >
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Capas
        </span>
        <span className="text-white/40">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.ids.map((id) => {
                  const layer = layers[id];
                  if (!layer) return null;
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 cursor-pointer text-[12px] text-white/80 hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={visible[id] ?? false}
                        onChange={() => onToggle(id)}
                        className="w-3.5 h-3.5 accent-blue-500"
                      />
                      <span>{layer.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
