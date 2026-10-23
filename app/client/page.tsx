"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, Topbar } from "@/app/page";
import { getSessionUser, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { Membership, Invoice, Booking, ClassSession, Class, Profile } from "@/app/lib/supabase/types";

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

function Empty({ message, icon = "○" }: { message: string; icon?: string }) {
  return (
    <div style={{ padding: "36px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 8, opacity: .2 }}>{icon}</div>
      <div style={{ color: "#3a3e44", fontSize: 10 }}>{message}</div>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  vip:     "linear-gradient(135deg,#1a0f00 0%,#0d1100 100%)",
  premium: "linear-gradient(135deg,#001020 0%,#0d1100 100%)",
  basic:   "linear-gradient(135deg,#0f1a00 0%,#111315 100%)",
};

const PLAN_ACCENT: Record<string, string> = {
  vip: "#ffad3c", premium: "#7fa4f0", basic: "#c7fa00",
};

const PLAN_PERKS: Record<string, string[]> = {
  vip:     ["Unlimited classes", "Personal training", "Locker room", "Guest passes"],
  premium: ["Unlimited classes", "Locker room", "Priority booking"],
  basic:   ["8 classes / month", "Locker room"],
};

const STATUS_MAP: Record<string, string> = {
  paid: "pill-paid", pending: "pill-pending", overdue: "pill-overdue", refunded: "pill-refunded",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    date:    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time:    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function ClientPage() {
  const router = useRouter();
  const [user, setUser]             = useState<SessionUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookings, setBookings]     = useState<BookingWithSession[]>([]);
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [available, setAvailable]   = useState<AvailableSession[]>([]);
  const [dataError, setDataError]   = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [booking, setBooking]       = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"upcoming" | "browse">("upcoming");

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "client") { router.push("/login"); return; }
    setUser(u);
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataError("");
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const [memRes, bookRes, invRes, availRes] = await Promise.all([
      supabase.from("memberships").select("*").eq("client_id", authUser.id).eq("status", "active").maybeSingle(),
      supabase.from("bookings").select(`*, class_sessions(*, classes(*, trainers(profiles(full_name))))`).eq("client_id", authUser.id).neq("status", "cancelled").order("booked_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("client_id", authUser.id).order("due_at", { ascending: false }),
      supabase.from("session_enrollment").select("*").eq("cancelled", false).gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(50),
    ]);

    const requestError = [memRes, bookRes, invRes, availRes].find(r => r.error)?.error;
    if (requestError) setDataError(`Some data could not be loaded: ${requestError.message}`);
    if (memRes.data)   setMembership(memRes.data);
    if (bookRes.data)  setBookings(bookRes.data as BookingWithSession[]);
    if (invRes.data)   setInvoices(invRes.data);
    if (availRes.data) setAvailable(availRes.data as AvailableSession[]);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  async function handleCancel(bookingId: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancelling(bookingId);
    await createClient().from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
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

  const plan        = membership?.plan ?? "basic";
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1);
  const accent      = PLAN_ACCENT[plan];
  const memberSince = membership ? new Date(membership.started_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";
  const expiresDate = membership?.expires_at ? new Date(membership.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const priceLabel  = membership ? `$${(membership.price_cents / 100).toFixed(2)}/mo` : "—";

  const bookedSessionIds  = new Set(bookings.map(b => b.session_id));
  const availableToBook   = available.filter(s => !bookedSessionIds.has(s.session_id) && s.enrolled < s.capacity);
  const upcomingBookings  = bookings.filter(b => b.class_sessions && new Date(b.class_sessions.starts_at) >= new Date());
  const overdueCount      = invoices.filter(i => i.status === "overdue").length;
  const paidCount         = invoices.filter(i => i.status === "paid").length;

  // Days until expiry
  const daysLeft = membership?.expires_at
    ? Math.max(0, Math.ceil((new Date(membership.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <main className="dashboard-shell">
      <Sidebar active="client" />
      <section className="content">
          <Topbar title="My Dashboard" />

        <div className="page-body">

          {dataError && (
            <div role="alert" className="auth-alert auth-alert-error">
              <span className="auth-alert-icon">⚠</span><span>{dataError}</span>
            </div>
          )}

          {/* ── Hero banner ── */}
          <div className="client-hero">
            <div className="client-hero-left">
              <div className={`avatar avatar-${user.avatarColor} client-hero-avatar`}>{user.avatar}</div>
              <div>
                <p className="client-hero-eyebrow">Welcome back</p>
                <h2 className="client-hero-name">{user.name}</h2>
                <p className="client-hero-sub">
                  <span className="client-plan-dot" style={{ background: accent }} />
                  {planLabel} Plan · Member since {memberSince}
                </p>
              </div>
            </div>
            <div className="client-hero-stats">
              {[
                { label: "Upcoming",  val: String(upcomingBookings.length), accent: "#c7fa00" },
                { label: "Paid",      val: String(paidCount),               accent: "#c7fa00" },
                { label: "Overdue",   val: String(overdueCount),            accent: overdueCount > 0 ? "#e36464" : "#505660" },
              ].map(s => (
                <div key={s.label} className="client-hero-stat">
                  <strong style={{ color: s.accent }}>{s.val}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="two-col-6040">
            {/* ── Left column ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Tab switcher */}
              <div className="client-tabs">
                <button
                  className={`client-tab${activeTab === "upcoming" ? " client-tab-active" : ""}`}
                  onClick={() => setActiveTab("upcoming")}
                >
                  My Classes
                  {upcomingBookings.length > 0 && (
                    <span className="client-tab-badge">{upcomingBookings.length}</span>
                  )}
                </button>
                <button
                  className={`client-tab${activeTab === "browse" ? " client-tab-active" : ""}`}
                  onClick={() => setActiveTab("browse")}
                >
                  Browse &amp; Book
                  {availableToBook.length > 0 && (
                    <span className="client-tab-badge">{availableToBook.length}</span>
                  )}
                </button>
              </div>

              {/* My booked classes */}
              {activeTab === "upcoming" && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>Upcoming Classes</h2>
                    <span className="hint">{upcomingBookings.length} booked</span>
                  </div>
                  {upcomingBookings.length === 0
                    ? <Empty message="No upcoming classes — browse and book one below" icon="▣" />
                    : upcomingBookings.map(b => {
                      const ses = b.class_sessions;
                      const cls = ses?.classes;
                      const trainer = cls?.trainers?.profiles?.full_name ?? "—";
                      const { weekday, date, time } = ses ? formatDate(ses.starts_at) : { weekday: "—", date: "—", time: "—" };
                      return (
                        <div key={b.id} className="client-class-row">
                          <div className="client-class-date">
                            <span>{weekday}</span>
                            <strong>{date}</strong>
                            <small>{time}</small>
                          </div>
                          <div className={`class-line ${cls?.color ?? "lime"}`} />
                          <div className="client-class-info">
                            <strong>{cls?.title ?? "—"}</strong>
                            <small>{trainer} · {cls?.room ?? "—"} · {cls?.duration_min ?? "—"}min</small>
                          </div>
                          <div className="client-class-actions">
                            <span className="status-pill" style={{
                              background: b.status === "booked" ? "rgba(199,250,0,.1)" : "rgba(255,173,60,.1)",
                              color: b.status === "booked" ? "#c7fa00" : "#ffad3c",
                            }}>{b.status}</span>
                            <button className="client-cancel-btn" onClick={() => handleCancel(b.id)} disabled={cancelling === b.id}>
                              {cancelling === b.id ? "…" : "Cancel"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              )}

              {/* Browse & book */}
              {activeTab === "browse" && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>Available Classes</h2>
                    <span className="hint">{availableToBook.length} open</span>
                  </div>
                  {availableToBook.length === 0
                    ? <Empty message="No upcoming classes available to book" icon="▣" />
                    : availableToBook.map(s => {
                      const spotsLeft = s.capacity - s.enrolled;
                      const { weekday, date, time } = formatDate(s.starts_at);
                      const pct = Math.round(s.enrolled / s.capacity * 100);
                      return (
                        <div key={s.session_id} className="client-class-row">
                          <div className="client-class-date">
                            <span>{weekday}</span>
                            <strong>{date}</strong>
                            <small>{time}</small>
                          </div>
                          <div className={`class-line ${s.color}`} />
                          <div className="client-class-info">
                            <strong>{s.title}</strong>
                            <small>{s.trainer_name ?? "—"} · {s.room} · {s.duration_min}min</small>
                            <div className="client-capacity-bar">
                              <div className="prog-track" style={{ flex: 1, height: 3 }}>
                                <div className="prog-fill" style={{ width: `${pct}%`, background: spotsLeft <= 3 ? "#e36464" : "#c7fa00" }} />
                              </div>
                              <span style={{ fontSize: 8, color: spotsLeft <= 3 ? "#e36464" : "#505660", whiteSpace: "nowrap" }}>
                                {spotsLeft} left
                              </span>
                            </div>
                          </div>
                          <button
                            className="client-book-btn"
                            onClick={() => handleBook(s.session_id)}
                            disabled={booking === s.session_id}
                          >
                            {booking === s.session_id ? "…" : "Book"}
                          </button>
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>

            {/* ── Right column ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Membership card */}
              <div className="client-membership-card" style={{ background: PLAN_COLORS[plan] }}>
                <div className="client-membership-top">
                  <div>
                    <p className="client-membership-eyebrow" style={{ color: accent }}>Membership</p>
                    <h3 className="client-membership-plan">{planLabel} Plan</h3>
                  </div>
                  <span className="brand-mark" style={{ color: accent, fontSize: 18 }}>✦</span>
                </div>

                <div className="client-membership-grid">
                  <div>
                    <p className="client-membership-label">Since</p>
                    <p className="client-membership-value">{memberSince}</p>
                  </div>
                  <div>
                    <p className="client-membership-label">Expires</p>
                    <p className="client-membership-value" style={{ color: daysLeft !== null && daysLeft < 30 ? "#e36464" : accent }}>
                      {expiresDate}
                    </p>
                  </div>
                  <div>
                    <p className="client-membership-label">Amount</p>
                    <p className="client-membership-value">{priceLabel}</p>
                  </div>
                  <div>
                    <p className="client-membership-label">Days left</p>
                    <p className="client-membership-value" style={{ color: daysLeft !== null && daysLeft < 30 ? "#e36464" : "#f3f4f2" }}>
                      {daysLeft !== null ? daysLeft : "—"}
                    </p>
                  </div>
                </div>

                <div className="client-membership-perks" style={{ borderColor: `${accent}22` }}>
                  {(PLAN_PERKS[plan] ?? []).map(perk => (
                    <span key={perk} className="client-perk" style={{ color: accent }}>
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {perk}
                    </span>
                  ))}
                </div>
              </div>

              {/* Billing history */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Billing History</h2>
                  {overdueCount > 0 && (
                    <span style={{ fontSize: 9, color: "#e36464", fontWeight: 700 }}>{overdueCount} overdue</span>
                  )}
                </div>
                {invoices.length === 0
                  ? <Empty message="No billing history" icon="◎" />
                  : invoices.slice(0, 6).map(inv => (
                    <div key={inv.id} className="client-invoice-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="client-invoice-desc">{inv.description}</p>
                        <p className="client-invoice-date">{new Date(inv.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span className="client-invoice-amount">${(inv.amount_cents / 100).toFixed(2)}</span>
                        <span className={`status-pill ${STATUS_MAP[inv.status]}`}>{inv.status}</span>
                      </div>
                    </div>
                  ))
                }
                {invoices.length > 6 && (
                  <div style={{ padding: "10px 14px", fontSize: 8, color: "#505660", textAlign: "center" }}>
                    +{invoices.length - 6} more invoices
                  </div>
                )}
              </div>

              {/* Quick stats */}
              <div className="panel">
                <div className="panel-heading"><h2>Quick Stats</h2></div>
                {[
                  { label: "Active Bookings",   val: String(bookings.length),                              color: "#c7fa00" },
                  { label: "Classes Attended",  val: String(bookings.filter(b => b.status === "attended").length), color: "#c7fa00" },
                  { label: "Paid Invoices",     val: String(paidCount),                                    color: "#c7fa00" },
                  { label: "Overdue Invoices",  val: String(overdueCount),                                 color: overdueCount > 0 ? "#e36464" : "#505660" },
                  { label: "Membership Status", val: membership?.status ?? "—",                            color: "#c7fa00" },
                ].map(s => (
                  <div key={s.label} className="stat-row">
                    <span className="label">{s.label}</span>
                    <span className="val" style={{ color: s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
