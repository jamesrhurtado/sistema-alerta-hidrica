import Link from "next/link";
import { Building2, LogOut } from "lucide-react";

import { getCurrentMunicipality } from "@/lib/session";
import { logout } from "@/app/actions/auth";

export async function MunicipalityBadge() {
  const muni = await getCurrentMunicipality();

  if (!muni) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
      >
        <Building2 className="w-3.5 h-3.5" />
        Ingresar como municipalidad
      </Link>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/5 px-3 py-1.5 text-xs">
        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-white/90 font-medium max-w-[200px] truncate">
          {muni.nombre}
        </span>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white/80"
          title="Cerrar sesión"
        >
          <LogOut className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
}
