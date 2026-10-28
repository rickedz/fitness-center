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
  session_id: string; title: string; room: string; color: string;
  capacity: number; duration_min: number; trainer_name: string | null;
  enrolled: number; starts_at: string;
};

const PLAN_ACCENT: Record<string, string> = { vip: "#ffad3c", premium: "#7fa4f0", basic: "#c7fa00" };
const PLAN_LABEL:  Record<string, string> = { vip: "VIP", premium: "Premium", basic: "Basic" };
const PLAN_LIMIT:  Record<string, number> = { basic: 8, premium: 20, vip: 30 };
const PLAN_PERKS:  Record<string, string[]> = {
  vip:     ["Unlimited classes", "Personal training", "Locker room", "Guest passes"],
  premium: ["Unlimited classes", "Locker room", "Priority booking"],
  basic:   ["8 classes / month", "Locker room"],
};
const STATUS_MAP: Record<string, string> = {
  paid: "pill-paid", pending: "pill-pending", overdue: "pill-overdue", refunded: "pill-refunded",
};
const CLASS_BG: Record<string, string> = {
  red: "#ee4b65", orange: "#ffad3c", teal: "#00c9a7",
  lime: "#c7fa00", blue: "#507be2", purple: "#9b72f0",
};

type ModalSession = {
  session_id: string;
  title: string;
  room: string;
  color: string;
  capacity: number;
  duration_min: number;
  trainer_name: string | null;
  enrolled: number;
  starts_at: string;
  ends_at?: string;
  booking_id?: string;
  booking_status?: string;
  is_booked: boolean;
};

function SessionModal({ s, onClose, onBook, onCancel, booking, cancelling }: {
  s: ModalSession;
  onClose: () => void;
  onBook: (id: string) => void;
  onCancel: (id: string) => void;
  booking: string | null;
  cancelling: string | null;
}) {
  const color    = CLASS_BG[s.color] ?? "#c7fa00";
  const { weekday, date, time, full } = fmt(s.starts_at);
  const now      = new Date();
  const isToday  = full.toDateString() === now.toDateString();
  const isSoon   = full.getTime() - now.getTime() < 3600000 && full > now;
  const spotsLeft = s.capacity - s.enrolled;
  const pct      = Math.round(s.enrolled / s.capacity * 100);
  const hot      = spotsLeft <= 3;
  const endTime  = s.ends_at ? new Date(s.ends_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : null;

  // close on backdrop click
  function onBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sm-backdrop" onClick={onBackdrop} role="dialog" aria-modal="true">
      <div className="sm-panel">
        {/* colour bar */}
        <div className="sm-bar" style={{ background: color }} />

        {/* header */}
        <div className="sm-header">
          <div>
            <p className="sm-eyebrow" style={{ color }}>Class Session</p>
            <h2 className="sm-title">{s.title}</h2>
          </div>
          <button className="sm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* badges */}
        <div className="sm-badges">
          {isToday  && <span className="cf-today-badge">Today</span>}
          {isSoon   && <span className="cf-soon-badge">Starting soon</span>}
          {hot      && !s.is_booked && <span className="cf-hot-badge">Almost full</span>}
          {s.is_booked && (
            <span className="status-pill" style={{ background: "rgba(199,250,0,.1)", color: "#c7fa00" }}>
              {s.booking_status ?? "booked"}
            </span>
          )}
        </div>

        {/* info grid */}
        <div className="sm-grid">
          <div className="sm-info-item">
            <span className="sm-info-icon">📅</span>
            <div>
              <p className="sm-info-label">Date</p>
              <p className="sm-info-val">{weekday}, {date}</p>
            </div>
          </div>
          <div className="sm-info-item">
            <span className="sm-info-icon">🕐</span>
            <div>
              <p className="sm-info-label">Time</p>
              <p className="sm-info-val">{time}{endTime ? ` – ${endTime}` : ""}</p>
            </div>
          </div>
          <div className="sm-info-item">
            <span className="sm-info-icon">📍</span>
            <div>
              <p className="sm-info-label">Room</p>
              <p className="sm-info-val">{s.room}</p>
            </div>
          </div>
          <div className="sm-info-item">
            <span className="sm-info-icon">⏱</span>
            <div>
              <p className="sm-info-label">Duration</p>
              <p className="sm-info-val">{s.duration_min} min</p>
            </div>
          </div>
          <div className="sm-info-item">
            <span className="sm-info-icon">🏋️</span>
            <div>
              <p className="sm-info-label">Trainer</p>
              <p className="sm-info-val">{s.trainer_name ?? "—"}</p>
            </div>
          </div>
          <div className="sm-info-item">
            <span className="sm-info-icon">👥</span>
            <div>
              <p className="sm-info-label">Capacity</p>
              <p className="sm-info-val" style={{ color: hot ? "#e36464" : "#f3f4f2" }}>
                {s.enrolled} / {s.capacity} enrolled
              </p>
            </div>
          </div>
        </div>

        {/* capacity bar */}
        <div className="sm-cap-section">
          <div className="sm-cap-row">
            <span style={{ fontSize: 10, color: "#6b7077" }}>Spots filled</span>
            <span style={{ fontSize: 10, color: hot ? "#e36464" : "#c7fa00", fontWeight: 700 }}>
              {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
            </span>
          </div>
          <div className="sm-cap-track">
            <div className="sm-cap-fill" style={{ width: `${pct}%`, background: hot ? "#e36464" : color }} />
          </div>
        </div>

        {/* action */}
        <div className="sm-footer">
          {s.is_booked && s.booking_id ? (
            <button
              className="sm-cancel-btn"
              onClick={() => { onCancel(s.booking_id!); onClose(); }}
              disabled={cancelling === s.booking_id}
            >
              {cancelling === s.booking_id ? "Cancelling…" : "Cancel Booking"}
            </button>
          ) : (
            <button
              className="sm-book-btn"
              style={{ background: color, borderColor: color }}
              onClick={() => { onBook(s.session_id); onClose(); }}
              disabled={booking === s.session_id || spotsLeft === 0}
            >
              {booking === s.session_id ? "Booking…" : spotsLeft === 0 ? "Class Full" : "Book This Class"}
            </button>
          )}
          <button className="sm-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    date:    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time:    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    full:    d,
  };
}

function Ring({ pct, color, size = 56, stroke = 5 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r   = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct / 100, 1);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1c1f23" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .6s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10, opacity: .12 }}>◎</div>
      <p style={{ color: "#3a3e44", fontSize: 11, margin: 0 }}>{msg}</p>
    </div>
  );
}

export default function ClientPage() {
  const router = useRouter();
  const [user, setUser]             = useState<SessionUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookings, setBookings]     = useState<BookingWithSession[]>([]);
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [available, setAvailable]   = useState<AvailableSession[]>([]);
  const [allEnrollment, setAllEnrollment] = useState<AvailableSession[]>([]);
  const [dataError, setDataError]   = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [booking, setBooking]       = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"schedule" | "browse">("schedule");
  const [modal, setModal]           = useState<ModalSession | null>(null);

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "client") { router.push("/login"); return; }
    setUser(u);
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataError("");
    const supabase = createClient();
    const { data: { user: au } } = await supabase.auth.getUser();
    if (!au) return;
    const [mR, bR, iR, eR] = await Promise.all([
      supabase.from("memberships").select("*").eq("client_id", au.id).eq("status", "active").maybeSingle(),
      supabase.from("bookings").select(`*, class_sessions(*, classes(*, trainers(profiles(full_name))))`).eq("client_id", au.id).neq("status", "cancelled").order("booked_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("client_id", au.id).order("due_at", { ascending: false }),
      supabase.from("session_enrollment").select("*").eq("cancelled", false).gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(200),
    ]);
    if (mR.data)  setMembership(mR.data);
    if (bR.data)  setBookings(bR.data as BookingWithSession[]);
    if (iR.data)  setInvoices(iR.data);
    if (eR.data)  { setAllEnrollment(eR.data as AvailableSession[]); setAvailable(eR.data as AvailableSession[]); }
    const err = [mR, bR, iR, eR].find(r => r.error)?.error;
    if (err) setDataError(err.message);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  async function handleCancel(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setModal(null);
    setCancelling(id);
    await createClient().from("bookings").update({ status: "cancelled" }).eq("id", id);
    await fetchData();
    setCancelling(null);
  }

  async function handleBook(sessionId: string) {
    const supabase = createClient();
    const { data: { user: au } } = await supabase.auth.getUser();
    if (!au) return;
    setBooking(sessionId);
    const { error } = await supabase.from("bookings").insert({ session_id: sessionId, client_id: au.id, status: "booked" });
    if (error) alert(error.message);
    else await fetchData();
    setBooking(null);
  }

  if (!user) return null;

  // ── Derived values ────────────────────────────────────────────────────────
  const plan       = membership?.plan ?? "basic";
  const accent     = PLAN_ACCENT[plan];
  const now        = new Date();
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const bookedIds      = new Set(bookings.map(b => b.session_id));
  const upcoming       = bookings.filter(b => b.class_sessions && new Date(b.class_sessions.starts_at) >= now);
  const availToBook    = allEnrollment.filter(s => !bookedIds.has(s.session_id) && s.enrolled < s.capacity);
  const paidCount      = invoices.filter(i => i.status === "paid").length;
  const overdueCount   = invoices.filter(i => i.status === "overdue").length;
  const daysLeft       = membership?.expires_at
    ? Math.max(0, Math.ceil((new Date(membership.expires_at).getTime() - now.getTime()) / 86400000)) : null;
  const weeklyCount    = bookings.filter(b => b.class_sessions && new Date(b.class_sessions.starts_at) >= weekStart).length;
  const weeklyGoal     = 3;
  const monthlyCount   = bookings.filter(b => b.class_sessions && new Date(b.class_sessions.starts_at) >= monthStart).length;
  const monthlyLimit   = PLAN_LIMIT[plan];
  const billingHealth  = invoices.length > 0 ? Math.round(paidCount / invoices.length * 100) : 100;
  const attendedCount  = bookings.filter(b => b.status === "attended").length;

  let streak = 0;
  for (let w = 1; w <= 12; w++) {
    const wEnd = new Date(weekStart); wEnd.setDate(weekStart.getDate() - (w - 1) * 7);
    const wSt  = new Date(wEnd);      wSt.setDate(wEnd.getDate() - 7);
    const has  = bookings.some(b => {
      if (!b.class_sessions) return false;
      const t = new Date(b.class_sessions.starts_at);
      return t >= wSt && t < wEnd && (b.status === "attended" || b.status === "booked");
    });
    if (has) streak++; else break;
  }

  // Next class
  const nextClass = upcoming.sort((a, b) =>
    new Date(a.class_sessions.starts_at).getTime() - new Date(b.class_sessions.starts_at).getTime()
  )[0];
  const nextMs    = nextClass ? new Date(nextClass.class_sessions.starts_at).getTime() - now.getTime() : null;
  const nextHrs   = nextMs !== null ? Math.floor(nextMs / 3600000) : null;
  const nextMins  = nextMs !== null ? Math.floor((nextMs % 3600000) / 60000) : null;

  // This week's schedule (next 7 days)
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const thisWeekBookings = upcoming
    .filter(b => new Date(b.class_sessions.starts_at) <= weekEnd)
    .sort((a, b) => new Date(a.class_sessions.starts_at).getTime() - new Date(b.class_sessions.starts_at).getTime());

  const memberSince = membership
    ? new Date(membership.started_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";
  const expiresDate = membership?.expires_at
    ? new Date(membership.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

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

          {/* ── Hero ── */}
          <div className="cf-hero" style={{ borderColor: `${accent}22` }}>
            <div className="cf-hero-bg" style={{ background: `radial-gradient(ellipse at 0% 50%, ${accent}18 0%, transparent 60%)` }} />
            <div className="cf-hero-left">
              <div className={`cf-avatar avatar-${user.avatarColor}`}>{user.avatar}</div>
              <div>
                <p className="cf-eyebrow" style={{ color: accent }}>Welcome back</p>
                <h2 className="cf-name">{user.name}</h2>
                <div className="cf-meta">
                  <span className="cf-plan-badge" style={{ background: `${accent}18`, color: accent, borderColor: `${accent}30` }}>
                    {PLAN_LABEL[plan]} Member
                  </span>
                  <span className="cf-meta-sep">·</span>
                  <span>Since {memberSince}</span>
                </div>
              </div>
            </div>

            {/* Next class countdown */}
            {nextClass && nextMs !== null && nextMs > 0 ? (
              <div className="cf-next-class">
                <p className="cf-next-label">Next Class</p>
                <p className="cf-next-title">{nextClass.class_sessions.classes?.title ?? "—"}</p>
                <p className="cf-next-time">
                  {nextHrs! > 0 ? `${nextHrs}h ${nextMins}m` : `${nextMins}m`} away
                </p>
                <p className="cf-next-meta">
                  {fmt(nextClass.class_sessions.starts_at).time} · {nextClass.class_sessions.classes?.room ?? "—"}
                </p>
              </div>
            ) : (
              <div className="cf-next-class">
                <p className="cf-next-label">No Upcoming Classes</p>
                <p className="cf-next-title" style={{ fontSize: 13, color: "#505660" }}>Browse &amp; book a session</p>
              </div>
            )}

            <div className="cf-hero-kpis">
              {[
                { label: "Classes\nBooked",   val: String(upcoming.length),  color: accent },
                { label: "Attended\nTotal",   val: String(attendedCount),    color: accent },
                { label: "Overdue\nInvoices", val: String(overdueCount),     color: overdueCount > 0 ? "#e36464" : "#505660" },
                { label: "Days\nLeft",        val: daysLeft !== null ? String(daysLeft) : "—", color: daysLeft !== null && daysLeft < 30 ? "#e36464" : accent },
              ].map(k => (
                <div key={k.label} className="cf-kpi">
                  <strong style={{ color: k.color }}>{k.val}</strong>
                  <span>{k.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Progress rings ── */}
          <div className="cf-rings-row">
            {[
              {
                label: "Weekly Goal",
                sub: `${weeklyCount} of ${weeklyGoal} classes`,
                pct: Math.min(100, Math.round(weeklyCount / weeklyGoal * 100)),
                color: weeklyCount >= weeklyGoal ? "#c7fa00" : "#7fa4f0",
                val: `${weeklyCount}/${weeklyGoal}`,
              },
              {
                label: "Monthly Usage",
                sub: `${monthlyCount} of ${monthlyLimit} classes`,
                pct: Math.min(100, Math.round(monthlyCount / monthlyLimit * 100)),
                color: monthlyCount >= monthlyLimit ? "#e36464" : "#c7fa00",
                val: `${monthlyCount}/${monthlyLimit}`,
              },
              {
                label: "Streak",
                sub: streak >= 4 ? "🔥 On fire!" : streak >= 2 ? "Keep it up!" : "Start your streak",
                pct: Math.min(100, Math.round(streak / 8 * 100)),
                color: streak >= 4 ? "#ffad3c" : streak >= 2 ? "#c7fa00" : "#505660",
                val: `${streak}wk`,
              },
              {
                label: "Billing Health",
                sub: overdueCount > 0 ? `${overdueCount} overdue` : "All paid up ✓",
                pct: billingHealth,
                color: billingHealth === 100 ? "#c7fa00" : billingHealth >= 70 ? "#ffad3c" : "#e36464",
                val: `${billingHealth}%`,
              },
            ].map(r => (
              <div key={r.label} className="cf-ring-card">
                <Ring pct={r.pct} color={r.color} size={60} stroke={5} />
                <div className="cf-ring-info">
                  <p className="cf-ring-label">{r.label}</p>
                  <p className="cf-ring-val" style={{ color: r.color }}>{r.val}</p>
                  <p className="cf-ring-sub">{r.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main grid ── */}
          <div className="cf-main-grid">

            {/* ── Left: Schedule / Browse ── */}
            <div className="cf-left">

              {/* Tabs */}
              <div className="cf-tabs">
                <button className={`cf-tab${activeTab === "schedule" ? " cf-tab-on" : ""}`} onClick={() => setActiveTab("schedule")}>
                  My Schedule
                  {thisWeekBookings.length > 0 && <span className="cf-tab-badge">{thisWeekBookings.length}</span>}
                </button>
                <button className={`cf-tab${activeTab === "browse" ? " cf-tab-on" : ""}`} onClick={() => setActiveTab("browse")}>
                  Browse &amp; Book
                  {availToBook.length > 0 && <span className="cf-tab-badge">{availToBook.length}</span>}
                </button>
              </div>

              {/* Schedule */}
              {activeTab === "schedule" && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>This Week</h2>
                    <span className="hint">{upcoming.length} total booked</span>
                  </div>
                  {upcoming.length === 0
                    ? <Empty msg="No upcoming classes — browse and book one" />
                    : upcoming.map(b => {
                        const ses = b.class_sessions;
                        const cls = ses?.classes;
                        const trainer = cls?.trainers?.profiles?.full_name ?? "—";
                        const { weekday, date, time, full } = ses ? fmt(ses.starts_at) : { weekday: "—", date: "—", time: "—", full: new Date() };
                        const isToday = full.toDateString() === now.toDateString();
                        const isSoon  = full.getTime() - now.getTime() < 3600000 && full > now;
                        const color   = CLASS_BG[cls?.color ?? "lime"] ?? "#c7fa00";
                        return (
                          <div key={b.id} className="cf-session-row" style={{ cursor: "pointer" }}
                            onClick={() => {
                              const enrollment = allEnrollment.find(a => a.session_id === b.session_id);
                              const ses = b.class_sessions;
                              const cls = ses?.classes;
                              setModal({
                                session_id: b.session_id,
                                title: cls?.title ?? "—",
                                room: cls?.room ?? "—",
                                color: cls?.color ?? "lime",
                                capacity: cls?.capacity ?? 0,
                                duration_min: cls?.duration_min ?? 0,
                                trainer_name: cls?.trainers?.profiles?.full_name ?? "—",
                                enrolled: enrollment?.enrolled ?? 0,
                                starts_at: ses.starts_at,
                                ends_at: ses.ends_at,
                                booking_id: b.id,
                                booking_status: b.status,
                                is_booked: true,
                              });
                            }}>
                            <div className="cf-session-date" style={{ borderColor: `${color}40` }}>
                              <span className="cf-session-wd">{weekday}</span>
                              <strong className="cf-session-d">{date}</strong>
                              <span className="cf-session-t">{time}</span>
                              {isToday && <span className="cf-today-dot" style={{ background: color }} />}
                            </div>
                            <div className="cf-session-accent" style={{ background: color }} />
                            <div className="cf-session-body">
                              <div className="cf-session-top">
                                <strong>{cls?.title ?? "—"}</strong>
                                {isSoon && <span className="cf-soon-badge">Starting soon</span>}
                                {isToday && !isSoon && <span className="cf-today-badge">Today</span>}
                              </div>
                              <p className="cf-session-meta">{trainer} · {cls?.room ?? "—"} · {cls?.duration_min ?? "—"} min</p>
                            </div>
                            <div className="cf-session-actions" onClick={e => e.stopPropagation()}>
                              <span className="status-pill" style={{
                                background: b.status === "booked" ? "rgba(199,250,0,.1)" : "rgba(255,173,60,.1)",
                                color: b.status === "booked" ? "#c7fa00" : "#ffad3c",
                              }}>{b.status}</span>
                              <button className="cf-cancel-btn" onClick={() => handleCancel(b.id)} disabled={cancelling === b.id}>
                                {cancelling === b.id ? "…" : "Cancel"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              )}

              {/* Browse */}
              {activeTab === "browse" && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>Available Classes</h2>
                    <span className="hint">{availToBook.length} open spots</span>
                  </div>
                  {availToBook.length === 0
                    ? <Empty msg="No classes available to book right now" />
                    : availToBook.map(s => {
                        const spotsLeft = s.capacity - s.enrolled;
                        const { weekday, date, time } = fmt(s.starts_at);
                        const pct   = Math.round(s.enrolled / s.capacity * 100);
                        const color = CLASS_BG[s.color] ?? "#c7fa00";
                        const hot   = spotsLeft <= 3;
                        return (
                          <div key={s.session_id} className="cf-session-row" style={{ cursor: "pointer" }}
                            onClick={() => setModal({ ...s, is_booked: false })}>
                            <div className="cf-session-date" style={{ borderColor: `${color}40` }}>
                              <span className="cf-session-wd">{weekday}</span>
                              <strong className="cf-session-d">{date}</strong>
                              <span className="cf-session-t">{time}</span>
                            </div>
                            <div className="cf-session-accent" style={{ background: color }} />
                            <div className="cf-session-body">
                              <div className="cf-session-top">
                                <strong>{s.title}</strong>
                                {hot && <span className="cf-hot-badge">Almost full</span>}
                              </div>
                              <p className="cf-session-meta">{s.trainer_name ?? "—"} · {s.room} · {s.duration_min} min</p>
                              <div className="cf-capacity-row">
                                <div className="cf-cap-track">
                                  <div className="cf-cap-fill" style={{ width: `${pct}%`, background: hot ? "#e36464" : color }} />
                                </div>
                                <span className="cf-cap-label" style={{ color: hot ? "#e36464" : "#505660" }}>
                                  {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                                </span>
                              </div>
                            </div>
                            <button className="cf-book-btn" onClick={e => { e.stopPropagation(); handleBook(s.session_id); }} disabled={booking === s.session_id}>
                              {booking === s.session_id ? "…" : "Book"}
                            </button>
                          </div>
                        );
                      })
                  }
                </div>
              )}
            </div>

            {/* ── Right: Membership + Billing ── */}
            <div className="cf-right">

              {/* Membership card */}
              <div className="cf-membership" style={{
                background: plan === "vip"
                  ? "linear-gradient(135deg,#1a0f00,#0d0e10)"
                  : plan === "premium"
                  ? "linear-gradient(135deg,#001428,#0d0e10)"
                  : "linear-gradient(135deg,#0f1a00,#0d0e10)",
                borderColor: `${accent}25`,
              }}>
                <div className="cf-mem-header">
                  <div>
                    <p className="cf-mem-eyebrow" style={{ color: accent }}>Membership</p>
                    <h3 className="cf-mem-plan">{PLAN_LABEL[plan]} Plan</h3>
                  </div>
                  <div className="cf-mem-badge" style={{ background: `${accent}15`, borderColor: `${accent}30`, color: accent }}>
                    {membership?.status ?? "active"}
                  </div>
                </div>

                {/* Expiry progress */}
                {membership && daysLeft !== null && (
                  <div className="cf-mem-expiry">
                    <div className="cf-mem-expiry-row">
                      <span>Expires {expiresDate}</span>
                      <span style={{ color: daysLeft < 30 ? "#e36464" : accent }}>{daysLeft}d left</span>
                    </div>
                    <div className="cf-mem-bar-track">
                      <div className="cf-mem-bar-fill" style={{
                        width: `${Math.min(100, Math.round(daysLeft / 365 * 100))}%`,
                        background: daysLeft < 30 ? "#e36464" : accent,
                      }} />
                    </div>
                  </div>
                )}

                <div className="cf-mem-grid">
                  <div><p className="cf-mem-lbl">Since</p><p className="cf-mem-val">{memberSince}</p></div>
                  <div><p className="cf-mem-lbl">Monthly</p><p className="cf-mem-val" style={{ color: accent }}>{membership ? `$${(membership.price_cents / 100).toFixed(2)}` : "—"}</p></div>
                </div>

                <div className="cf-mem-perks" style={{ borderColor: `${accent}20` }}>
                  {(PLAN_PERKS[plan] ?? []).map(p => (
                    <div key={p} className="cf-perk">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6l3 3 5-5" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ color: accent }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Billing</h2>
                  {overdueCount > 0
                    ? <span style={{ fontSize: 10, color: "#e36464", fontWeight: 700 }}>{overdueCount} overdue</span>
                    : <span style={{ fontSize: 10, color: "#c7fa00", fontWeight: 600 }}>✓ All clear</span>
                  }
                </div>
                {invoices.length === 0
                  ? <Empty msg="No billing history yet" />
                  : invoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="cf-invoice-row">
                      <div className={`cf-inv-dot ${inv.status === "paid" ? "cf-inv-dot-paid" : inv.status === "overdue" ? "cf-inv-dot-overdue" : "cf-inv-dot-pending"}`} />
                      <div className="cf-inv-body">
                        <p className="cf-inv-desc">{inv.description}</p>
                        <p className="cf-inv-date">{new Date(inv.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                      <div className="cf-inv-right">
                        <span className="cf-inv-amt">${(inv.amount_cents / 100).toFixed(2)}</span>
                        <span className={`status-pill ${STATUS_MAP[inv.status]}`}>{inv.status}</span>
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Quick stats */}
              <div className="panel">
                <div className="panel-heading"><h2>Activity Summary</h2></div>
                {[
                  { label: "Total Bookings",    val: bookings.length,    color: "#c7fa00" },
                  { label: "Classes Attended",  val: attendedCount,      color: "#c7fa00" },
                  { label: "This Week",         val: weeklyCount,        color: weeklyCount >= weeklyGoal ? "#c7fa00" : "#7fa4f0" },
                  { label: "This Month",        val: monthlyCount,       color: "#c7fa00" },
                  { label: "Attendance Streak", val: `${streak} wk`,     color: streak >= 4 ? "#ffad3c" : "#c7fa00" },
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

      {/* ── Session modal ── */}
      {modal && (
        <SessionModal
          s={modal}
          onClose={() => setModal(null)}
          onBook={handleBook}
          onCancel={handleCancel}
          booking={booking}
          cancelling={cancelling}
        />
      )}
    </main>
  );
}
