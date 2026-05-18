import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

// "/" es la landing publica. /login es para autenticarse.
const PUBLIC_EXACT = new Set(["/", "/login"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas publicas
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p + "/") || pathname === p)) {
    return NextResponse.next();
  }

  // Si no hay sesion, redirigir a login
  const session = request.cookies.get(SESSION_COOKIE);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Solo correr en pages, no en assets estaticos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
