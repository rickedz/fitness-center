import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { applyRouting as middleware } from "../app/lib/routing";
import { ROLE_COOKIE } from "../app/lib/auth";

function makeRequest(pathname: string, role?: string) {
  const req = new NextRequest(`http://localhost:3000${pathname}`);
  if (role) req.cookies.set(ROLE_COOKIE, role);
  return req;
}

function redirectTarget(response: Response) {
  return new URL(response.headers.get("location")!).pathname;
}

// ── Unauthenticated ───────────────────────────────────────────────────────────
describe("middleware — unauthenticated", () => {
  it("redirects / to /login", () => {
    const res = middleware(makeRequest("/"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
  });

  it("redirects /revenue to /login", () => {
    const res = middleware(makeRequest("/revenue"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
  });

  it("redirects /admin/users to /login", () => {
    const res = middleware(makeRequest("/admin/users"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
  });

  it("sets ?next= param on redirect", () => {
    const res = middleware(makeRequest("/billing"));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/billing");
  });

  it("allows /login through", () => {
    expect(middleware(makeRequest("/login")).status).toBe(200);
  });

  it("allows /signup through", () => {
    expect(middleware(makeRequest("/signup")).status).toBe(200);
  });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
describe("middleware — admin role", () => {
  it("allows / through", () => {
    expect(middleware(makeRequest("/", "admin")).status).toBe(200);
  });

  it("allows /revenue through", () => {
    expect(middleware(makeRequest("/revenue", "admin")).status).toBe(200);
  });

  it("allows /admin/users through", () => {
    expect(middleware(makeRequest("/admin/users", "admin")).status).toBe(200);
  });

  it("redirects /login to / when already logged in", () => {
    const res = middleware(makeRequest("/login", "admin"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/");
  });

  it("redirects /signup to / when already logged in", () => {
    const res = middleware(makeRequest("/signup", "admin"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/");
  });
});

// ── Staff ─────────────────────────────────────────────────────────────────────
describe("middleware — staff role", () => {
  it("allows /staff through", () => {
    expect(middleware(makeRequest("/staff", "staff")).status).toBe(200);
  });

  it("allows /classes through", () => {
    expect(middleware(makeRequest("/classes", "staff")).status).toBe(200);
  });

  it("redirects / to /staff", () => {
    const res = middleware(makeRequest("/", "staff"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/staff");
  });

  it("redirects /billing to /staff", () => {
    const res = middleware(makeRequest("/billing", "staff"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/staff");
  });

  it("redirects /admin/users to /staff", () => {
    const res = middleware(makeRequest("/admin/users", "staff"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/staff");
  });
});

// ── Client ────────────────────────────────────────────────────────────────────
describe("middleware — client role", () => {
  it("allows /client through", () => {
    expect(middleware(makeRequest("/client", "client")).status).toBe(200);
  });

  it("redirects / to /client", () => {
    const res = middleware(makeRequest("/", "client"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/client");
  });

  it("redirects /staff to /client", () => {
    const res = middleware(makeRequest("/staff", "client"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/client");
  });
});

// ── Unguarded routes ──────────────────────────────────────────────────────────
describe("middleware — unguarded routes", () => {
  it("passes through unknown routes", () => {
    expect(middleware(makeRequest("/some-random-page")).status).toBe(200);
  });
});
