import { AlertTriangle } from "lucide-react";

import type { LayerStack } from "@/lib/api";
import { fmtNum } from "@/lib/utils";

export function CuencaStats({ stack }: { stack: LayerStack }) {
  const s = stack.stats;
  const pctAlert = s.pct_expansion_inund > 5;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-2 text-sm">
      <div className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
        📊 Resumen del análisis
      </div>

      <Row
        label="🏗️ Expansión urbana total"
        value={`${fmtNum(s.area_urb_expansion_ha, 1)} ha`}
        accent="#cc4c02"
        bold
      />
      <Row
        label="    sobre/cerca de agua"
        value={`${fmtNum(s.area_urb_inund_ha, 1)} ha (${fmtNum(s.pct_expansion_inund, 1)}%)`}
        accent="#b30000"
        indent
      />
      <Row
        label="⚠️ Urb. antiguo en zona de agua"
        value={`${fmtNum(s.area_urb_inund_antiguo_ha, 1)} ha`}
        accent="#cc4c02"
      />

      <hr className="border-white/10 my-2" />

      <Row
        label="👥 Pob. en RIESGO ALTO"
        value={`${fmtNum(s.pop_high_risk)} hab.`}
        accent="#ef4444"
        bold
        big
      />
      <Row
        label="👥 Pob. total expuesta"
        value={`${fmtNum(s.pop_total_expuesta)} hab.`}
        accent="#60a5fa"
      />
      <Row
        label="🎯 IVC promedio (zona urbana)"
        value={`${fmtNum(s.ivc_mean, 1)} / 100`}
        accent="#a78bfa"
      />
      <Row
        label="🎯 IVC máximo"
        value={`${fmtNum(s.ivc_max, 1)} / 100`}
        accent="#f97316"
      />
      <Row
        label="🌆 Área urbana total"
        value={`${fmtNum(s.area_urb_total_ha, 1)} ha`}
        accent="#9ca3af"
      />

      {pctAlert && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-300">
              ALERTA: {fmtNum(s.pct_expansion_inund, 1)}% de la nueva ocupación urbana está en zona inundable.
            </div>
            <div className="text-red-400/80 mt-0.5">
              Indicador crítico de planificación: expansión post-{stack.year_urb_start} sobre cauces o quebradas.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  bold = false,
  big = false,
  indent = false,
}: {
  label: string;
  value: string;
  accent: string;
  bold?: boolean;
  big?: boolean;
  indent?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline ${indent ? "pl-3" : ""}`}>
      <span className={`text-white/70 ${big ? "text-sm" : "text-xs"}`}>{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-bold" : ""} ${big ? "text-base" : "text-sm"}`}
        style={{ color: accent }}
      >
        {value}
      </span>
    </div>
  );
}
