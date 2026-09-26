"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/page";
import { getSessionUser, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { Membership, Invoice, Booking, ClassSession, Class, Trainer, Profile } from "@/app/lib/supabase/types";

type BookingWithSession = Booking & {
  class_sessions: ClassSession & {
    classes: Class & { trainers: { profiles: Pick<Profile, "full_name"> } | null };
  };
};

type AvailableSession = {
  session_id: string;
  title: string;
  room: string;
  color: string;
  capacity: number;
  duration_min: number;
  trainer_name: string | null;
  enrolled: number;
  starts_at: string;
};

function Empty({ message }: { message: string }) {
  return (
    <div style={{ padding: "32px 14px", textAlign: "center", color: "#3a3e44", fontSize: 9 }}>
      {message}
    </div>
  );
}

const STATUS_MAP: Record<string, string> = {
  paid: "pill-paid", pending: "pill-pending", overdue: "pill-overdue", refunded: "pill-refunded",
};

export default function ClientPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookings, setBookings] = useState<BookingWithSession[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [available, setAvailable] = useState<AvailableSession[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [booking, setBooking] = useState<string | null>(null);

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "client") { router.push("/login"); return; }
    setUser(u);
  }, [router]);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const [memRes, bookRes, invRes, availRes] = await Promise.all([
      supabase.from("memberships").select("*").eq("client_id", authUser.id).eq("status", "active").maybeSingle(),
      supabase.from("bookings").select(`*, class_sessions(*, classes(*, trainers(profiles(full_name))))`).eq("client_id", authUser.id).neq("status", "cancelled").order("booked_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("client_id", authUser.id).order("due_at", { ascending: false }),
      supabase.from("session_enrollment").select("*").gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(8),
    ]);

    if (memRes.data)  setMembership(memRes.data);
    if (bookRes.data) setBookings(bookRes.data as BookingWithSession[]);
    if (invRes.data)  setInvoices(invRes.data);
    if (availRes.data) setAvailable(availRes.data as AvailableSession[]);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  async function handleCancel(bookingId: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancelling(bookingId);
    const supabase = createClient();
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    await fetchData();
    setCancelling(null);
  }

  async function handleBook(sessionId: string) {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setBooking(sessionId);
    const { error } = await supabase.from("bookings").insert({ session_id: sessionId, client_id: authUser.id, status: "booked" });
    if (error) alert(error.message);
    else await fetchData();
    setBooking(null);
  }

  if (!user) return null;

  const plan = membership?.plan ?? "basic";
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const memberSince = membership ? new Date(membership.started_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";
  const nextPayment = membership?.expires_at ? new Date(membership.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const priceLabel = membership ? `$${(membership.price_cents / 100).toFixed(2)} / mo` : "—";

  const bookedSessionIds = new Set(bookings.map(b => b.session_id));
  const availableToBook = available.filter(s => !bookedSessionIds.has(s.session_id) && s.enrolled < s.capacity);

  const totalAttended = invoices.filter(i => i.status === "paid").length;

  return (
    <main className="dashboard-shell">
      <Sidebar active="client" />
      <section className="content">
        <header className="topbar">
          <h1>My Dashboard</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search classes…" /></label>
            <button className="status">Active Member</button>
          </div>
        </header>

        <div className="page-body">
          {/* Welcome banner */}
          <div className="panel" style={{ background: "linear-gradient(135deg,#0f1a00 0%,#111315 60%)", border: "1px solid rgba(199,250,0,.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
              <div className={`avatar avatar-${user.avatarColor}`} style={{ width: 52, height: 52, fontSize: 14, flex: "0 0 52px" }}>
                {user.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#c7fa00", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Welcome back</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1 }}>{user.name}</div>
                <div style={{ fontSize: 9, color: "#6b7077", marginTop: 5 }}>{planLabel} Plan · Member since {memberSince}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--line)", borderRadius: 8, overflow: "hidden" }}>
                {[
                  { label: "Classes Booked", val: String(bookings.length) },
                  { label: "Invoices",        val: String(invoices.length) },
                  { label: "Plan",            val: planLabel },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--panel)", padding: "12px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.04em", color: "#c7fa00" }}>{s.val}</div>
                    <div style={{ fontSize: 7, color: "#505660", marginTop: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="two-col-6040">
            {/* Left */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Booked classes */}
              <div className="panel">
                <div className="panel-heading"><h2>My Booked Classes</h2></div>
                {bookings.length === 0
                  ? <Empty message="No classes booked yet" />
                  : bookings.map(b => {
                    const ses = b.class_sessions;
                    const cls = ses?.classes;
                    const trainerName = cls?.trainers?.profiles?.full_name ?? "—";
                    const startDate = ses ? new Date(ses.starts_at) : null;
                    const timeLabel = startDate
                      ? startDate.toLocaleDateString("en-US", { weekday: "short" }) + " · " +
                        startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                      : "—";
                    return (
                      <div key={b.id} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                        <div className={`class-line ${cls?.color ?? "lime"}`} style={{ alignSelf: "stretch", minHeight: 38 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 10 }}>{cls?.title ?? "—"}</strong>
                          <small style={{ display: "block", color: "#505660", fontSize: 8, marginTop: 2 }}>{timeLabel} · {trainerName} · {cls?.room ?? "—"}</small>
                        </div>
                        <span className="status-pill" style={{
                          background: b.status === "booked" ? "rgba(199,250,0,.1)" : "rgba(255,173,60,.1)",
                          color: b.status === "booked" ? "#c7fa00" : "#ffad3c",
                        }}>{b.status}</span>
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancelling === b.id}
                          style={{ marginLeft: 6, background: "transparent", border: "1px solid var(--line)", borderRadius: 4, color: "#e36464", fontSize: 8, padding: "3px 8px", cursor: "pointer", opacity: cancelling === b.id ? .5 : 1 }}>
                          {cancelling === b.id ? "…" : "Cancel"}
                        </button>
                      </div>
                    );
                  })
                }
              </div>

              {/* Available to book */}
              <div className="panel">
                <div className="panel-heading"><h2>Available to Book</h2></div>
                {availableToBook.length === 0
                  ? <Empty message="No upcoming classes available" />
                  : availableToBook.map(s => {
                    const spotsLeft = s.capacity - s.enrolled;
                    const startDate = new Date(s.starts_at);
                    const timeLabel = startDate.toLocaleDateString("en-US", { weekday: "short" }) + " · " +
                      startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={s.session_id} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                        <div className={`class-line ${s.color}`} style={{ alignSelf: "stretch", minHeight: 34 }} />
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 10 }}>{s.title}</strong>
                          <small style={{ display: "block", color: "#505660", fontSize: 8, marginTop: 2 }}>{timeLabel} · {s.trainer_name ?? "—"}</small>
                        </div>
                        <span style={{ fontSize: 8, color: spotsLeft <= 3 ? "#e36464" : "#505660", marginRight: 8 }}>{spotsLeft} spots left</span>
                        <button
                          onClick={() => handleBook(s.session_id)}
                          disabled={booking === s.session_id}
                          style={{ background: "rgba(199,250,0,.1)", border: "1px solid rgba(199,250,0,.25)", borderRadius: 4, color: "#c7fa00", fontSize: 8, fontWeight: 700, padding: "4px 10px", cursor: "pointer", opacity: booking === s.session_id ? .5 : 1 }}>
                          {booking === s.session_id ? "…" : "Book"}
                        </button>
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Right */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Membership card */}
              <div className="panel" style={{ background: "linear-gradient(135deg,#0f1a00,#0d1500)", border: "1px solid rgba(199,250,0,.2)" }}>
                <div style={{ padding: "16px 16px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 8, color: "#c7fa00", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Membership</div>
                    <span className="brand-mark" style={{ fontSize: 12 }}>✦</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.04em", marginBottom: 4 }}>{planLabel} Plan</div>
                  <div style={{ fontSize: 9, color: "#6b7077", marginBottom: 16 }}>Since {memberSince}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 7, color: "#505660", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Expires</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c7fa00" }}>{nextPayment}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: "#505660", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Amount</div>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>{priceLabel}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, background: "rgba(199,250,0,.08)", border: "1px solid rgba(199,250,0,.15)", borderRadius: 5, padding: "8px 10px", fontSize: 8, color: "#c7fa00" }}>
                    {plan === "vip" ? "✓ Unlimited classes · ✓ Personal training · ✓ Locker room"
                      : plan === "premium" ? "✓ Unlimited classes · ✓ Locker room"
                      : "✓ 8 classes / month · ✓ Locker room"}
                  </div>
                </div>
              </div>

              {/* Billing history */}
              <div className="panel">
                <div className="panel-heading"><h2>Billing History</h2></div>
                {invoices.length === 0
                  ? <Empty message="No billing history" />
                  : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Description</th><th>Amount</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id}>
                          <td style={{ fontSize: 9 }}>{inv.description}</td>
                          <td className="td-lime">${(inv.amount_cents / 100).toFixed(2)}</td>
                          <td><span className={`status-pill ${STATUS_MAP[inv.status]}`}>{inv.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
              </div>

              {/* Stats */}
              <div className="panel">
                <div className="panel-heading"><h2>My Stats</h2></div>
                <div className="stat-row"><span className="label">Active Bookings</span><span className="val lime">{bookings.length}</span></div>
                <div className="stat-row"><span className="label">Total Invoices</span><span className="val">{invoices.length}</span></div>
                <div className="stat-row"><span className="label">Paid Invoices</span><span className="val lime">{invoices.filter(i => i.status === "paid").length}</span></div>
                <div className="stat-row"><span className="label">Overdue</span><span className="val red">{invoices.filter(i => i.status === "overdue").length}</span></div>
                <div className="stat-row"><span className="label">Membership Status</span><span className="val lime">{membership?.status ?? "—"}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
