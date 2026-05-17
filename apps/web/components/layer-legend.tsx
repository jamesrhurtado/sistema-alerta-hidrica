"use client";

import type { TileLayer } from "@/lib/api";

type Props = {
  layers: Record<string, TileLayer>;
  visible: Record<string, boolean>;
  totalYears: number;
  yearUrbStart: number;
  yearUrbEnd: number;
};

function ColorBar({ palette, min, max, label }: { palette: string[]; min: number | string; max: number | string; label: string }) {
  const stops = palette
    .map((c, i) => `${c} ${(i / (palette.length - 1)) * 100}%`)
    .join(", ");
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="h-2.5 rounded" style={{ background: `linear-gradient(to right, ${stops})` }} />
      <div className="flex justify-between text-[10px] text-white/50 font-mono">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function LayerLegend({ layers, visible, totalYears, yearUrbStart, yearUrbEnd }: Props) {
  const items: React.ReactNode[] = [];

  if (visible["ivc"] && layers["ivc"]) {
    items.push(
      <ColorBar
        key="ivc"
        palette={layers["ivc"].palette}
        min={15}
        max={80}
        label="🎯 Vulnerabilidad (IVC)"
      />,
    );
  }
  if (visible["agua_freq"] && layers["agua_freq"]) {
    items.push(
      <ColorBar
        key="agua_freq"
        palette={layers["agua_freq"].palette}
        min={1}
        max={Math.max(2, Math.round(totalYears * 0.6))}
        label="🌊 Años con agua (1984–2021)"
      />,
    );
  }
  if (visible["urbano_temporal"] && layers["urbano_temporal"]) {
    items.push(
      <ColorBar
        key="urbano_temporal"
        palette={layers["urbano_temporal"].palette}
        min={yearUrbStart}
        max={yearUrbEnd}
        label="🏗️ Año de aparición urbana"
      />,
    );
  }

  const swatches: { color: string; label: string; border?: string }[] = [];
  if (visible["riesgo_nuevo"]) swatches.push({ color: "#ff0066", label: "🚨 Riesgo ALTO", border: "#660033" });
  if (visible["riesgo_antiguo"]) swatches.push({ color: "#fdae6b", label: "⚠️ Riesgo medio", border: "#cc4c02" });

  return (
    <div className="rounded-lg border border-white/10 bg-black/70 backdrop-blur px-3 py-2.5 space-y-2 w-[260px]">
      <div className="text-xs font-semibold text-white/80">📖 Leyenda dinámica</div>
      {items.length === 0 && swatches.length === 0 ? (
        <div className="text-[11px] text-white/40">Activá capas para ver la leyenda.</div>
      ) : (
        <>
          {items.length > 0 && <div className="space-y-2">{items}</div>}
          {swatches.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Intersecciones</div>
              {swatches.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 rounded-sm"
                    style={{
                      background: s.color,
                      border: s.border ? `1.5px solid ${s.border}` : "1px solid rgba(255,255,255,0.2)",
                    }}
                  />
                  <span className="text-[11px] text-white/70">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
