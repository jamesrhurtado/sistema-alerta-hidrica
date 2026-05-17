import Link from "next/link";

import { api } from "@/lib/api";
import { loginAs } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const municipalities = await api.municipalities();

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-6">
      <header className="text-center space-y-2">
        <div className="text-5xl">🌊</div>
        <h1 className="text-2xl font-bold text-white">Ingresar a AHORA</h1>
        <p className="text-sm text-white/60">
          Sistema de alerta temprana de inundaciones y huaicos para gobiernos locales.
        </p>
      </header>

      {/* Botón Microsoft (stub para hackatón). En producción inicia OAuth Entra. */}
      <form action={async () => {
        "use server";
        // En producción: redirigir a Microsoft OAuth (ver MS_AUTH.md).
        // Para demo: usá el selector de municipalidad de abajo.
      }}>
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-3 rounded-md bg-[#2F2F2F] px-4 py-3 text-white font-semibold border border-white/10 opacity-60 cursor-not-allowed"
          title="OAuth de Microsoft está stub en demo — ver docs/MS_AUTH.md"
        >
          <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Continuar con Microsoft
          <span className="text-xs text-white/50">(producción)</span>
        </button>
      </form>

      <div className="relative flex items-center gap-3 text-xs text-white/40 uppercase">
        <div className="flex-1 border-t border-white/10" />
        <span>o seleccioná demo</span>
        <div className="flex-1 border-t border-white/10" />
      </div>

      <div className="space-y-2">
        {municipalities.map((m) => (
          <form key={m.id} action={async () => { "use server"; await loginAs(m.id); }}>
            <button
              type="submit"
              className="w-full text-left rounded-md border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-400/40 px-4 py-3 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{m.nombre}</div>
                  <div className="text-xs text-white/50">
                    {m.nivel} · {m.n_cuencas} cuenca{m.n_cuencas === 1 ? "" : "s"}
                    {m.domain_hint && ` · ${m.domain_hint}`}
                  </div>
                </div>
                <span className="text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          </form>
        ))}
      </div>

      <p className="text-xs text-white/30 text-center pt-4 border-t border-white/5">
        En demo, el botón Microsoft está deshabilitado. Usá uno de los selectores
        de municipalidad. La sesión se guarda en una cookie por 7 días.
      </p>
    </div>
  );
}
