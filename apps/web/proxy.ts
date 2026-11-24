import { NextResponse, type NextRequest } from "next/server";
import { authEnforced } from "@/lib/auth-enforced";

const SESSION_COOKIE = "pilla_session";

/** Rotas que não são do admin: login, portal do cliente e arquivos estáticos. */
function isOpenPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/_next/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

/** Sem cookie de sessão, rota do admin vai para /login?next=<caminho e query originais> (E14 D12). A API segue valendo. */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (!authEnforced() || isOpenPath(pathname) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const original = `${pathname}${search}`;
  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = original === "/" ? "" : `?next=${encodeURIComponent(original)}`;
  return NextResponse.redirect(target);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
