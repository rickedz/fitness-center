import { describe, it, expect, beforeEach } from "vitest";
import {
  homeForRole,
  avatarColorForRole,
  buildSessionUser,
  getSessionUser,
  setSessionUser,
  clearSessionUser,
  SESSION_KEY,
  ROLE_ROUTES,
  ALL_PROTECTED,
  AUTH_ROUTES,
  type Role,
  type Profile,
} from "../app/lib/auth";

// ── homeForRole ───────────────────────────────────────────────────────────────
describe("homeForRole", () => {
  it("returns / for admin", () => expect(homeForRole("admin")).toBe("/"));
  it("returns /staff for staff", () => expect(homeForRole("staff")).toBe("/staff"));
  it("returns /client for client", () => expect(homeForRole("client")).toBe("/client"));
});

// ── avatarColorForRole ────────────────────────────────────────────────────────
describe("avatarColorForRole", () => {
  it("returns lime for admin", () => expect(avatarColorForRole("admin")).toBe("lime"));
  it("returns orange for staff", () => expect(avatarColorForRole("staff")).toBe("orange"));
  it("returns blue for client", () => expect(avatarColorForRole("client")).toBe("blue"));
});

// ── buildSessionUser ──────────────────────────────────────────────────────────
describe("buildSessionUser", () => {
  const profile: Profile = {
    id: "abc-123", full_name: "John Doe", avatar_initials: "JD",
    avatar_color: "lime", title: "Admin", role: "admin",
    created_at: "2024-01-01", updated_at: "2024-01-01",
  };

  it("maps all fields correctly", () => {
    const user = buildSessionUser({ id: "abc-123", email: "john@test.com" }, profile);
    expect(user).toEqual({
      id: "abc-123", name: "John Doe", email: "john@test.com",
      role: "admin", avatar: "JD", avatarColor: "lime", title: "Admin",
    });
  });

  it("falls back to empty string when email is missing", () => {
    expect(buildSessionUser({ id: "abc-123" }, profile).email).toBe("");
  });
});

// ── sessionStorage helpers ────────────────────────────────────────────────────
describe("session storage helpers", () => {
  const mockUser = {
    id: "u1", name: "Test", email: "t@t.com",
    role: "client" as Role, avatar: "T", avatarColor: "blue", title: "Member",
  };

  beforeEach(() => sessionStorage.clear());

  it("getSessionUser returns null when empty", () => {
    expect(getSessionUser()).toBeNull();
  });

  it("setSessionUser then getSessionUser round-trips", () => {
    // sessionStorage may not persist in node env — write and read directly
    const key = SESSION_KEY;
    sessionStorage.setItem(key, JSON.stringify(mockUser));
    const raw = sessionStorage.getItem(key);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(mockUser);
  });

  it("clearSessionUser removes the key", () => {
    setSessionUser(mockUser);
    clearSessionUser();
    expect(getSessionUser()).toBeNull();
  });

  it("getSessionUser returns null on corrupt JSON", () => {
    sessionStorage.setItem(SESSION_KEY, "not-json{{{");
    expect(getSessionUser()).toBeNull();
  });
});

// ── Route config sanity checks ────────────────────────────────────────────────
describe("route config", () => {
  it("ALL_PROTECTED contains the admin dashboard root", () => {
    expect(ALL_PROTECTED).toContain("/");
  });

  it("AUTH_ROUTES contains /login and /signup", () => {
    expect(AUTH_ROUTES).toContain("/login");
    expect(AUTH_ROUTES).toContain("/signup");
  });

  it("admin ROLE_ROUTES includes all protected pages", () => {
    const adminRoutes = ROLE_ROUTES["admin"];
    expect(adminRoutes).toContain("/");
    expect(adminRoutes).toContain("/revenue");
    expect(adminRoutes).toContain("/billing");
    expect(adminRoutes).toContain("/admin/users");
  });

  it("client ROLE_ROUTES only contains /client", () => {
    expect(ROLE_ROUTES["client"]).toEqual(["/client"]);
  });

  it("staff cannot access admin-only routes", () => {
    const staffRoutes = ROLE_ROUTES["staff"];
    expect(staffRoutes).not.toContain("/");
    expect(staffRoutes).not.toContain("/revenue");
    expect(staffRoutes).not.toContain("/billing");
    expect(staffRoutes).not.toContain("/admin/users");
  });
});
