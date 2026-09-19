import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected routes — require auth cookie
const PROTECTED = ["/", "/revenue", "/classes", "/trainers", "/billing"];

// Auth routes — redirect to dashboard if already logged in
const AUTH_ROUTES = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = request.cookies.has("gritfit_session");

  // Redirect logged-in users away from login/signup
  if (AUTH_ROUTES.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users to login
  if (PROTECTED.includes(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/revenue", "/classes", "/trainers", "/billing", "/login", "/signup"],
};
