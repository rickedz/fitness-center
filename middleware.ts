import { NextResponse, type NextRequest } from "next/server";
import {
  ALL_PROTECTED,
  AUTH_ROUTES,
  ROLE_ROUTES,
  ROLE_COOKIE,
  homeForRole,
  type Role,
} from "@/app/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = ALL_PROTECTED.includes(pathname);
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (!isProtected && !isAuthRoute) return NextResponse.next();

  const role = request.cookies.get(ROLE_COOKIE)?.value as Role | undefined;

  // No role cookie = not logged in
  if (isProtected && !role) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in user hitting login/signup → send home
  if (isAuthRoute && role) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  // Wrong role for this route → send to their home
  if (isProtected && role) {
    const allowed = ROLE_ROUTES[role] ?? [];
    if (!allowed.includes(pathname)) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
