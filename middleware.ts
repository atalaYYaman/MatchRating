import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register", "/gizlilik", "/hesap-silme", "/sifremi-unuttum"];
// Token tasiyan rotalar: giris gerektirmez (sifresini unutan giris yapamaz).
const PUBLIC_PREFIXES = ["/dogrula/", "/sifre-sifirla/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API rotalarini ve statikleri middleware disinda birak; onlar kendi
  // route handler'larinda getSession() ile korunuyor.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname === "/";

  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
