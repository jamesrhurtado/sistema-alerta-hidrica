import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

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
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/ahora-logo.png"
                alt="AHORA"
                width={56}
                height={56}
                className="object-contain drop-shadow-[0_0_12px_rgba(96,165,250,0.35)]"
                priority
              />
              <div>
                <div className="font-bold text-white tracking-tight text-lg leading-none">AHORA</div>
                <div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                  Alerta Hídrica · LATAM
                </div>
              </div>
            </Link>
            <nav className="flex gap-1 text-sm">
              <NavLink href="/">
                <svg
                  className="inline-block w-4 h-4 mr-1.5 -mt-0.5 text-cyan-400"
                  viewBox="0 0 256 256"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M240,204H228V144a12,12,0,0,0,12.49-19.78L142.14,25.85a20,20,0,0,0-28.28,0L15.51,124.2A12,12,0,0,0,28,144v60H16a12,12,0,0,0,0,24H240a12,12,0,0,0,0-24ZM52,121.65l76-76,76,76V204H164V152a12,12,0,0,0-12-12H104a12,12,0,0,0-12,12v52H52ZM140,204H116V164h24Z" />
                </svg>
                Inicio
              </NavLink>
              <NavLink href="/cuenca/rimac">
                <Image
                  src="/icons/map.png"
                  alt=""
                  width={20}
                  height={20}
                  className="inline-block mr-1.5 align-middle object-contain hue-rotate-180 saturate-150 brightness-110"
                />
                Mapa Chosica
              </NavLink>
              <NavLink href="/replay">
                <Image
                  src="/icons/rewind.png"
                  alt=""
                  width={20}
                  height={20}
                  className="inline-block mr-1.5 align-middle object-contain hue-rotate-180 saturate-150 brightness-110"
                />
                Replay
              </NavLink>
              <NavLink href="/alertas">
                <Image
                  src="/icons/bell.png"
                  alt=""
                  width={20}
                  height={20}
                  className="inline-block mr-1.5 align-middle object-contain hue-rotate-180 saturate-150 brightness-110"
                />
                Alertas
              </NavLink>
              <NavLink href="/admin/outbox">
                <Image
                  src="/icons/phone.png"
                  alt=""
                  width={20}
                  height={20}
                  className="inline-block mr-1.5 align-middle object-contain hue-rotate-180 saturate-150 brightness-110"
                />
                Outbox
              </NavLink>
            </nav>
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
      href={href}
      className="px-3 py-1.5 rounded hover:bg-white/5 text-white/70 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
