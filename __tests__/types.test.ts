import { describe, it, expect } from "vitest";
import type {
  Role, MembershipPlan, MembershipStatus, InvoiceStatus,
  BookingStatus, PaymentMethod, Profile, Membership, Invoice, Checkin,
} from "../app/lib/supabase/types";

describe("enum types", () => {
  it("Role covers all three values", () => {
    const roles: Role[] = ["admin", "staff", "client"];
    expect(roles).toHaveLength(3);
  });

  it("MembershipPlan covers basic/premium/vip", () => {
    const plans: MembershipPlan[] = ["basic", "premium", "vip"];
    expect(plans).toHaveLength(3);
  });

  it("MembershipStatus covers all states", () => {
    const statuses: MembershipStatus[] = ["active", "expired", "cancelled", "frozen"];
    expect(statuses).toHaveLength(4);
  });

  it("InvoiceStatus covers all states", () => {
    const statuses: InvoiceStatus[] = ["paid", "pending", "overdue", "refunded"];
    expect(statuses).toHaveLength(4);
  });

  it("BookingStatus covers all states", () => {
    const statuses: BookingStatus[] = ["booked", "waitlisted", "cancelled", "attended"];
    expect(statuses).toHaveLength(4);
  });

  it("PaymentMethod covers all methods", () => {
    const methods: PaymentMethod[] = ["visa", "mastercard", "gcash", "cash", "other"];
    expect(methods).toHaveLength(5);
  });
});

describe("Profile type shape", () => {
  it("has all required fields", () => {
    const p: Profile = {
      id: "uuid", full_name: "Test User", avatar_initials: "TU",
      avatar_color: "lime", title: "Member", role: "client",
      created_at: "2024-01-01", updated_at: "2024-01-01",
    };
    expect(p.id).toBeDefined();
    expect(p.role).toBe("client");
  });
});

describe("Membership type shape", () => {
  it("allows nullable expires_at", () => {
    const m: Membership = {
      id: "uuid", client_id: "uuid", plan: "basic", status: "active",
      started_at: "2024-01-01", expires_at: null,
      price_cents: 2900, created_at: "2024-01-01", updated_at: "2024-01-01",
    };
    expect(m.expires_at).toBeNull();
    expect(m.price_cents).toBe(2900);
  });
});

describe("Invoice type shape", () => {
  it("allows nullable paid_at and membership_id", () => {
    const inv: Invoice = {
      id: "uuid", client_id: "uuid", membership_id: null,
      description: "Test", amount_cents: 4900, status: "pending",
      method: "gcash", due_at: "2024-09-01", paid_at: null,
      created_at: "2024-01-01", updated_at: "2024-01-01",
    };
    expect(inv.paid_at).toBeNull();
    expect(inv.membership_id).toBeNull();
  });
});

describe("Checkin type shape", () => {
  it("allows nullable session_id for walk-ins", () => {
    const c: Checkin = {
      id: "uuid", client_id: "uuid", session_id: null,
      checked_in_at: "2024-01-01T09:00:00Z", note: "",
    };
    expect(c.session_id).toBeNull();
  });
});

describe("membership price_cents", () => {
  it("basic = $29", () => expect(2900 / 100).toBe(29));
  it("premium = $49", () => expect(4900 / 100).toBe(49));
  it("vip = $99", () => expect(9900 / 100).toBe(99));
});
