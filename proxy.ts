import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ALL_PROTECTED,
  AUTH_ROUTES,
  ROLE_ROUTES,
  ROLE_COOKIE,
  homeForRole,
  type Role,
} from "@/app/lib/auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const role = request.cookies.get(ROLE_COOKIE)?.value as Role | undefined;

  // Logged-in users visiting auth pages → redirect to their home
  if (AUTH_ROUTES.includes(pathname) && user && role) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  // Unauthenticated users visiting protected pages → login
  if (ALL_PROTECTED.includes(pathname) && !user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated users visiting a page outside their role's allowed routes
  if (ALL_PROTECTED.includes(pathname) && user && role) {
    const allowed = ROLE_ROUTES[role] ?? [];
    if (!allowed.includes(pathname)) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
