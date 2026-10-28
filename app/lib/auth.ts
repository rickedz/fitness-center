// ── Role & profile types ──────────────────────────────────────────────────────

export type Role = "admin" | "staff" | "trainer" | "client";

/** Shape of the `profiles` table row */
export interface Profile {
  id: string;              // = auth.users.id (UUID)
  full_name: string;
  avatar_initials: string;
  avatar_color: string;
  title: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

/** Minimal shape stored in sessionStorage for display */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  avatarColor: string;
  title: string;
}

// ── Cookie / storage keys ─────────────────────────────────────────────────────

/** Supabase manages its own session cookies; we only store the role separately
 *  so middleware can make routing decisions without a DB round-trip. */
export const ROLE_COOKIE  = "gritfit_role";
export const SESSION_KEY  = "gritfit_user";

// ── Route access map ──────────────────────────────────────────────────────────

export const ROLE_ROUTES: Record<Role, string[]> = {
  admin:   ["/", "/revenue", "/classes", "/trainers", "/billing", "/admin/users", "/staff", "/client", "/trainer", "/profile"],
  staff:   ["/staff", "/classes", "/trainers", "/profile"],
  trainer: ["/trainer", "/classes", "/trainers", "/profile"],
  client:  ["/client"],
};

export const ALL_PROTECTED = [
  "/", "/revenue", "/classes", "/trainers", "/billing",
  "/admin/users", "/staff", "/client", "/trainer", "/profile",
];

export const AUTH_ROUTES = ["/login", "/signup"];

// ── Role helpers ──────────────────────────────────────────────────────────────

export function homeForRole(role: Role): string {
  if (role === "admin")   return "/";
  if (role === "staff")   return "/staff";
  if (role === "trainer") return "/trainer";
  return "/client";
}

export function avatarColorForRole(role: Role): string {
  if (role === "admin")   return "lime";
  if (role === "staff")   return "orange";
  if (role === "trainer") return "teal";
  return "blue";
}

// ── sessionStorage helpers (client-side only) ─────────────────────────────────

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSessionUser(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Build a SessionUser from a Supabase auth user + profile row */
export function buildSessionUser(
  authUser: { id: string; email?: string },
  profile: Profile
): SessionUser {
  return {
    id:          authUser.id,
    name:        profile.full_name,
    email:       authUser.email ?? "",
    role:        profile.role,
    avatar:      profile.avatar_initials,
    avatarColor: profile.avatar_color,
    title:       profile.title,
  };
}
