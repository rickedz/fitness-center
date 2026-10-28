import { NextResponse, type NextRequest } from "next/server";
import {
  ALL_PROTECTED,
  AUTH_ROUTES,
  ROLE_ROUTES,
  ROLE_COOKIE,
  homeForRole,
  type Role,
} from "@/app/lib/auth";

/** Pure routing logic — no Supabase, synchronous, fully testable. */
export function applyRouting(
  request: NextRequest,
  user?: { id: string } | null
): NextResponse {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get(ROLE_COOKIE)?.value as Role | undefined;
  const isAuthenticated = Boolean(user) || Boolean(role);

  if (AUTH_ROUTES.includes(pathname) && isAuthenticated && role) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  if (ALL_PROTECTED.includes(pathname) && !isAuthenticated) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (ALL_PROTECTED.includes(pathname) && role) {
    const allowed = ROLE_ROUTES[role] ?? [];
    if (!allowed.includes(pathname)) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
  }

  return NextResponse.next({ request });
}
