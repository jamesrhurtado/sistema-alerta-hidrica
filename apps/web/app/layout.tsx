import type { Metadata } from "next";
import Link from "next/link";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { MunicipalityBadge } from "@/components/municipality-badge";

export const metadata: Metadata = {
  title: "AHORA — Sistema de Alerta Hídrica Oportuna",
  description:
    "Sistema de alerta temprana de inundaciones y huaicos en Perú. Combina geointeligencia con pronósticos meteorológicos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans">
        <header className="border-b border-white/10 bg-[#050810]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-2xl">🌊</span>
              <div>
                <div className="font-bold text-white tracking-tight">AHORA</div>
                <div className="text-[10px] text-white/50 uppercase tracking-widest">
                  Alerta Hídrica · Perú
                </div>
              </div>
            </Link>
            <nav className="flex gap-1 text-sm flex-1 justify-center">
              <NavLink href="/dashboard">Inicio</NavLink>
              <NavLink href="/cuenca/rimac">🗺️ Mapa</NavLink>
              <NavLink href="/alertas">🔔 Alertas</NavLink>
              <NavLink href="/admin/analisis">🛰️ Análisis</NavLink>
              <NavLink href="/configuracion">⚙️</NavLink>
            </nav>
            <MunicipalityBadge />
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-white/10 mt-12 py-6 text-center text-xs text-white/40">
          AHORA · Hackatón Perú · Construido sobre AGUA &amp; ASFALTO v3
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={{ pathname: href }}
      className="px-3 py-1.5 rounded hover:bg-white/5 text-white/70 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
