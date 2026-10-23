"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, Topbar } from "@/app/page";
import { getSessionUser, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { SessionEnrollment, Checkin, Profile, Trainer } from "@/app/lib/supabase/types";

type CheckinWithProfile = Checkin & { profiles: Pick<Profile, "full_name" | "avatar_color" | "avatar_initials"> };

function Metric({ label, value, delta, note, icon, up = false }: { label: string; value: string; delta: string; note: string; icon: string; up?: boolean }) {
  return (
    <article className="metric">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      <p className="metric-delta"><span className={up ? "up" : "down"}>{delta}</span><em>{note}</em></p>
    </article>
  );
}

function Empty({ message }: { message: string }) {
  return <div style={{ padding: "32px 14px", textAlign: "center", color: "#3a3e44", fontSize: 9 }}>{message}</div>;
}

function FillRing({ pct }: { pct: number }) {
  const r = 28, c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  const color = pct >= 90 ? "#e36464" : pct >= 60 ? "#ffad3c" : "#00c9a7";
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="#1c1f23" strokeWidth={6} />
      <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${c}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray .4s" }} />
      <text x={36} y={40} textAnchor="middle" fill={color} fontSize={13} fontWeight={800}>{pct}%</text>
    </svg>
  );
}

function WeekStrip({ sessions }: { sessions: SessionEnrollment[] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  return (
    <div style={{ display: "flex", gap: 6, padding: "14px 17px" }}>
      {days.map((d, i) => {
        const count = sessions.filter(s => new Date(s.starts_at).toDateString() === d.toDateString()).length;
        const isToday = i === 0;
        return (
          <div key={i} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            padding: "10px 4px", borderRadius: 8,
            background: isToday ? "rgba(0,201,167,.08)" : "rgba(255,255,255,.02)",
            border: `1px solid ${isToday ? "rgba(0,201,167,.25)" : "var(--line)"}`,
          }}>
            <span style={{ fontSize: 8, color: isToday ? "#00c9a7" : "#505660", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {d.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#00c9a7" : "#c0c5cb", lineHeight: 1 }}>
              {d.getDate()}
            </span>
            {count > 0
              ? <span style={{ fontSize: 8, fontWeight: 700, color: isToday ? "#00c9a7" : "#ffad3c", background: isToday ? "rgba(0,201,167,.12)" : "rgba(255,173,60,.1)", borderRadius: 10, padding: "1px 6px" }}>{count}</span>
              : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1c1f23" }} />
            }
          </div>
        );
      })}
    </div>
  );
}

export default function TrainerPage() {
  const router = useRouter();
  const [user, setUser]             = useState<SessionUser | null>(null);
  const [trainerRow, setTrainerRow] = useState<Trainer | null>(null);
  const [sessions, setSessions]     = useState<SessionEnrollment[]>([]);
  const [checkins, setCheckins]     = useState<CheckinWithProfile[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "trainer") { router.push("/login"); return; }
    setUser(u);
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const weekEnd    = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);

    const [trainerRes, sesRes, checkinRes] = await Promise.all([
      supabase.from("trainers").select("*").eq("id", authUser.id).maybeSingle(),
      supabase.from("session_enrollment").select("*").gte("starts_at", new Date().toISOString()).lte("starts_at", weekEnd.toISOString()).order("starts_at", { ascending: true }),
      supabase.from("checkins").select("*, profiles(full_name, avatar_color, avatar_initials)").gte("checked_in_at", todayStart.toISOString()).lte("checked_in_at", todayEnd.toISOString()).order("checked_in_at", { ascending: false }),
    ]);

    if (trainerRes.data) setTrainerRow(trainerRes.data as Trainer);
    if (sesRes.data)     setSessions(sesRes.data as SessionEnrollment[]);
    if (checkinRes.data) setCheckins(checkinRes.data as CheckinWithProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  if (!user) return null;

  const mySessions    = sessions.filter(s => s.trainer_name === user.name);
  const todaySessions = mySessions.filter(s => new Date(s.starts_at).toDateString() === new Date().toDateString());
  const totalEnrolled = mySessions.reduce((sum, s) => sum + Number(s.enrolled), 0);
  const avgFill = mySessions.length > 0
    ? Math.round(mySessions.reduce((sum, s) => sum + (s.capacity > 0 ? Number(s.enrolled) / s.capacity : 0), 0) / mySessions.length * 100)
    : 0;

  const now = new Date();
  const nextSession = mySessions.find(s => new Date(s.starts_at) > now);
  const fullyBooked = mySessions.filter(s => Number(s.enrolled) >= s.capacity).length;

  return (
    <main className="dashboard-shell">
      <Sidebar active="trainer" />
      <section className="content">
        <Topbar title="Trainer Dashboard" />

        <div className="page-body">

          {/* Welcome banner */}
          <div className="panel" style={{ background: "linear-gradient(135deg,#001a12 0%,#111315 60%)", border: "1px solid rgba(0,201,167,.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", flexWrap: "wrap" }}>
              <div className={`avatar avatar-${user.avatarColor}`} style={{ width: 52, height: 52, fontSize: 14, flex: "0 0 52px" }}>
                {user.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 9, color: "#00c9a7", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Welcome back</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1 }}>{user.name}</div>
                <div style={{ fontSize: 9, color: "#6b7077", marginTop: 5 }}>{user.title}</div>
              </div>
              {trainerRow && (
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginLeft: "auto" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#ffad3c", letterSpacing: "-.04em" }}>★ {trainerRow.rating}</div>
                    <div style={{ fontSize: 8, color: "#505660", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 2 }}>Rating</div>
                    <span className="status-pill" style={{ background: "rgba(0,201,167,.1)", color: "#00c9a7", marginTop: 6, display: "inline-block" }}>{trainerRow.specialty}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <FillRing pct={avgFill} />
                    <span style={{ fontSize: 8, color: "#505660", textTransform: "uppercase", letterSpacing: ".06em" }}>Avg Fill</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="metrics">
            <Metric label="My Sessions (7d)"  value={loading ? "—" : String(mySessions.length)}    delta="scheduled" note="next 7 days"  icon="▣" up />
            <Metric label="Today's Classes"   value={loading ? "—" : String(todaySessions.length)} delta="today"     note="scheduled"   icon="◉" up />
            <Metric label="Total Enrolled"    value={loading ? "—" : String(totalEnrolled)}        delta="students"  note="across all"  icon="♟" up />
            <Metric label="Fully Booked"      value={loading ? "—" : String(fullyBooked)}          delta="sessions"  note="at capacity" icon="▱" up={fullyBooked === 0} />
          </div>

          <div className="two-col-6040">
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Next up */}
              {!loading && nextSession && (
                <div className="panel" style={{ border: "1px solid rgba(0,201,167,.2)", background: "linear-gradient(135deg,#001a12 0%,#111315 80%)" }}>
                  <div className="panel-heading" style={{ borderColor: "rgba(0,201,167,.15)" }}>
                    <h2 style={{ color: "#00c9a7" }}>▶ Next Up</h2>
                    <span style={{ fontSize: 9, color: "#00c9a7", fontWeight: 700 }}>
                      {new Date(nextSession.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, padding: "14px 17px", alignItems: "center" }}>
                    <div className={`class-line ${nextSession.color}`} style={{ alignSelf: "stretch", minHeight: 56 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 4 }}>{nextSession.title}</div>
                      <div style={{ fontSize: 9, color: "#505660", marginBottom: 8 }}>
                        {new Date(nextSession.starts_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(nextSession.ends_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{nextSession.room}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="prog-track" style={{ flex: 1 }}>
                          <div className="prog-fill" style={{
                            width: `${Math.round(Number(nextSession.enrolled) / nextSession.capacity * 100)}%`,
                            background: Number(nextSession.enrolled) >= nextSession.capacity ? "#e36464" : "#00c9a7",
                          }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#00c9a7", whiteSpace: "nowrap" }}>
                          {nextSession.enrolled}/{nextSession.capacity}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Week strip */}
              <div className="panel">
                <div className="panel-heading"><h2>This Week</h2><span className="hint">{mySessions.length} sessions</span></div>
                <WeekStrip sessions={mySessions} />
              </div>

              {/* Today's classes */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Today&apos;s Classes</h2>
                  <span className="hint">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : todaySessions.length === 0
                  ? <Empty message="No classes scheduled for you today" />
                  : todaySessions.map(s => {
                    const pct  = s.capacity > 0 ? Math.round(Number(s.enrolled) / s.capacity * 100) : 0;
                    const full = Number(s.enrolled) >= s.capacity;
                    const time = new Date(s.starts_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + "–" +
                      new Date(s.ends_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={s.session_id} style={{ display: "flex", gap: 10, padding: "13px 17px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                        <div className={`class-line ${s.color}`} style={{ alignSelf: "stretch", minHeight: 50 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <strong style={{ fontSize: 11 }}>{s.title}</strong>
                            <span className="status-pill" style={{
                              background: full ? "rgba(227,100,100,.1)" : "rgba(0,201,167,.1)",
                              color: full ? "#e36464" : "#00c9a7",
                            }}>{s.enrolled}/{s.capacity}{full ? " · FULL" : ""}</span>
                          </div>
                          <small style={{ color: "#505660", fontSize: 8 }}>{time} · {s.room}</small>
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 7, color: "#505660" }}>Enrollment</span>
                              <span style={{ fontSize: 7, color: full ? "#e36464" : "#00c9a7" }}>{pct}%</span>
                            </div>
                            <div className="prog-track">
                              <div className="prog-fill" style={{ width: `${pct}%`, background: full ? "#e36464" : "#00c9a7" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              {/* Upcoming sessions table */}
              <div className="panel">
                <div className="panel-heading"><h2>Upcoming Sessions</h2><span className="hint">{mySessions.length} total</span></div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : mySessions.length === 0
                  ? <Empty message="No upcoming sessions assigned to you" />
                  : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ minWidth: 480 }}>
                      <thead>
                        <tr><th>Class</th><th>Date &amp; Time</th><th>Room</th><th>Enrolled</th></tr>
                      </thead>
                      <tbody>
                        {mySessions.map(s => {
                          const full = Number(s.enrolled) >= s.capacity;
                          const d = new Date(s.starts_at);
                          return (
                            <tr key={s.session_id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div className={`class-line ${s.color}`} style={{ width: 3, height: 14, borderRadius: 2, flexShrink: 0 }} />
                                  <span style={{ fontWeight: 600 }}>{s.title}</span>
                                </div>
                              </td>
                              <td className="td-muted">
                                {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                {" · "}
                                {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="td-muted">{s.room}</td>
                              <td>
                                <span style={{ fontWeight: 600, color: full ? "#e36464" : "#00c9a7", fontSize: 10 }}>
                                  {s.enrolled}/{s.capacity}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Today's check-ins */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Today&apos;s Check-ins</h2>
                  <span style={{ fontSize: 9, color: "#00c9a7", fontWeight: 700 }}>{checkins.length} total</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : checkins.length === 0
                  ? <Empty message="No check-ins recorded today" />
                  : (
                  <div className="member-list">
                    {checkins.map(c => (
                      <div key={c.id} className="member">
                        <div className={`avatar avatar-${c.profiles?.avatar_color ?? "teal"}`}>
                          {c.profiles?.avatar_initials ?? "?"}
                        </div>
                        <div>
                          <strong>{c.profiles?.full_name ?? "—"}</strong>
                          <small style={{ color: "#505660" }}>{c.session_id ? "Class" : "Walk-in"}</small>
                        </div>
                        <time>{new Date(c.checked_in_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</time>
                      </div>
                    ))}
                  </div>
                  )}
              </div>

              {/* My profile */}
              {trainerRow && (
                <div className="panel">
                  <div className="panel-heading"><h2>My Profile</h2></div>
                  <div className="stat-row"><span className="label">Specialty</span><span className="val">{trainerRow.specialty}</span></div>
                  <div className="stat-row"><span className="label">Rating</span><span className="val" style={{ color: "#ffad3c" }}>★ {trainerRow.rating}</span></div>
                  <div className="stat-row"><span className="label">Status</span>
                    <span className="status-pill" style={{ background: "rgba(0,201,167,.1)", color: "#00c9a7" }}>{trainerRow.status}</span>
                  </div>
                  {trainerRow.bio && (
                    <div style={{ padding: "12px 17px", borderTop: "1px solid var(--line)", fontSize: 9, color: "#6b7077", lineHeight: 1.6 }}>
                      {trainerRow.bio}
                    </div>
                  )}
                </div>
              )}

              {/* Quick stats */}
              <div className="panel">
                <div className="panel-heading"><h2>Quick Stats</h2></div>
                <div className="stat-row"><span className="label">Sessions (7 days)</span><span className="val" style={{ color: "#00c9a7" }}>{mySessions.length}</span></div>
                <div className="stat-row"><span className="label">Today&apos;s Classes</span><span className="val" style={{ color: "#00c9a7" }}>{todaySessions.length}</span></div>
                <div className="stat-row"><span className="label">Total Enrolled</span><span className="val">{totalEnrolled}</span></div>
                <div className="stat-row"><span className="label">Avg. Fill Rate</span><span className="val" style={{ color: "#00c9a7" }}>{avgFill}%</span></div>
                <div className="stat-row"><span className="label">Fully Booked</span><span className="val" style={{ color: "#e36464" }}>{fullyBooked}</span></div>
                <div className="stat-row"><span className="label">Check-ins Today</span><span className="val">{checkins.length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
