"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/page";
import { getSessionUser, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { SessionEnrollment, Checkin, Profile } from "@/app/lib/supabase/types";

type CheckinWithProfile = Checkin & { profiles: Pick<Profile, "full_name" | "avatar_color" | "avatar_initials"> };

function Empty({ message }: { message: string }) {
  return <div style={{ padding: "32px 14px", textAlign: "center", color: "#3a3e44", fontSize: 9 }}>{message}</div>;
}

function Metric({ label, value, delta, note, icon, up = false }: { label: string; value: string; delta: string; note: string; icon: string; up?: boolean }) {
  return (
    <article className="metric">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      <p className="metric-delta"><span className={up ? "up" : "down"}>{delta}</span><em>{note}</em></p>
    </article>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessions, setSessions] = useState<SessionEnrollment[]>([]);
  const [checkins, setCheckins] = useState<CheckinWithProfile[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "staff") { router.push("/login"); return; }
    setUser(u);
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [sesRes, checkinRes, clientRes] = await Promise.all([
      supabase.from("session_enrollment").select("*").gte("starts_at", todayStart.toISOString()).lte("starts_at", todayEnd.toISOString()).order("starts_at"),
      supabase.from("checkins").select("*, profiles(full_name, avatar_color, avatar_initials)").gte("checked_in_at", todayStart.toISOString()).order("checked_in_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "client").order("full_name"),
    ]);

    if (sesRes.data)     setSessions(sesRes.data as SessionEnrollment[]);
    if (checkinRes.data) setCheckins(checkinRes.data as CheckinWithProfile[]);
    if (clientRes.data)  setClients(clientRes.data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  async function handleCheckin() {
    if (!selectedClient) { alert("Select a member first."); return; }
    setCheckingIn(true);
    const supabase = createClient();
    const { error } = await supabase.from("checkins").insert({
      client_id:  selectedClient,
      session_id: selectedSession || null,
      note: "",
    });
    if (error) alert("Check-in failed: " + error.message);
    else {
      setSelectedClient("");
      setSelectedSession("");
      await fetchData();
    }
    setCheckingIn(false);
  }

  if (!user) return null;

  return (
    <main className="dashboard-shell">
      <Sidebar active="staff" />
      <section className="content">
        <header className="topbar">
          <h1>Staff Dashboard</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search members…" /></label>
            <button className="status">On Duty</button>
          </div>
        </header>

        <div className="page-body">
          <div className="metrics">
            <Metric label="Classes Today"    value={loading ? "—" : String(sessions.length)}  delta="scheduled" note="today"     icon="▣" up />
            <Metric label="Check-ins Today"  value={loading ? "—" : String(checkins.length)}  delta="recorded"  note="today"     icon="⌁" up />
            <Metric label="Members on File"  value={loading ? "—" : String(clients.length)}   delta="clients"   note="total"     icon="♟" />
            <Metric label="Fully Booked"     value={loading ? "—" : String(sessions.filter(s=>Number(s.enrolled)>=s.capacity).length)} delta="today" note="at capacity" icon="◒" />
          </div>

          <div className="two-col-6040">
            {/* Left */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Check-in form */}
              <div className="panel">
                <div className="panel-heading"><h2>Record Check-in</h2></div>
                <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 8, color: "#9da1a5", fontWeight: 600, display: "block", marginBottom: 5 }}>Member</label>
                    <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                      style={{ width: "100%", height: 36, background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 5, color: selectedClient ? "#f2f3f1" : "#505660", fontSize: 10, padding: "0 10px", outline: "none" }}>
                      <option value="">Select member…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 8, color: "#9da1a5", fontWeight: 600, display: "block", marginBottom: 5 }}>Session (optional)</label>
                    <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
                      style={{ width: "100%", height: 36, background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 5, color: selectedSession ? "#f2f3f1" : "#505660", fontSize: 10, padding: "0 10px", outline: "none" }}>
                      <option value="">Walk-in</option>
                      {sessions.map(s => {
                        const t = new Date(s.starts_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                        return <option key={s.session_id} value={s.session_id}>{s.title} · {t}</option>;
                      })}
                    </select>
                  </div>
                  <button onClick={handleCheckin} disabled={checkingIn || !selectedClient}
                    style={{ height: 36, background: "rgba(199,250,0,.1)", border: "1px solid rgba(199,250,0,.25)", borderRadius: 5, color: "#c7fa00", fontSize: 9, fontWeight: 700, padding: "0 16px", cursor: checkingIn || !selectedClient ? "not-allowed" : "pointer", opacity: checkingIn || !selectedClient ? .5 : 1 }}>
                    {checkingIn ? "…" : "Check in ↗"}
                  </button>
                </div>
              </div>

              {/* Today's sessions */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Today's Classes</h2>
                  <span className="hint">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : sessions.length === 0
                  ? <Empty message="No classes scheduled today" />
                  : sessions.map(s => {
                    const pct  = s.capacity > 0 ? Math.round(Number(s.enrolled) / s.capacity * 100) : 0;
                    const full = Number(s.enrolled) >= s.capacity;
                    const startDate = new Date(s.starts_at);
                    const endDate   = new Date(s.ends_at);
                    const timeLabel = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + "–" +
                      endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={s.session_id} style={{ display: "flex", gap: 10, padding: "13px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                        <div className={`class-line ${s.color}`} style={{ alignSelf: "stretch", minHeight: 50 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <strong style={{ fontSize: 11 }}>{s.title}</strong>
                            <span className="status-pill" style={{
                              background: full ? "rgba(227,100,100,.1)" : "rgba(199,250,0,.1)",
                              color: full ? "#e36464" : "#c7fa00",
                            }}>{s.enrolled}/{s.capacity}{full ? " · FULL" : ""}</span>
                          </div>
                          <small style={{ color: "#505660", fontSize: 8 }}>{timeLabel} · {s.trainer_name ?? "—"} · {s.room}</small>
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 7, color: "#505660" }}>Enrollment</span>
                              <span style={{ fontSize: 7, color: full ? "#e36464" : "#c7fa00" }}>{pct}%</span>
                            </div>
                            <div className="prog-track">
                              <div className="prog-fill" style={{ width: `${pct}%`, background: full ? "#e36464" : "#c7fa00" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Right */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Live check-ins */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Today's Check-ins</h2>
                  <span style={{ fontSize: 9, color: "#c7fa00", fontWeight: 700 }}>{checkins.length} total</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : checkins.length === 0
                  ? <Empty message="No check-ins yet today" />
                  : (
                  <div className="member-list">
                    {checkins.map(c => (
                      <div key={c.id} className="member">
                        <div className={`avatar avatar-${c.profiles?.avatar_color ?? "lime"}`}>
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

              {/* Members list */}
              <div className="panel">
                <div className="panel-heading"><h2>Client Members</h2><span style={{ fontSize: 9, color: "#505660" }}>{clients.length} total</span></div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : clients.slice(0, 8).map(c => (
                  <div key={c.id} className="member">
                    <div className={`avatar avatar-${c.avatar_color}`}>{c.avatar_initials}</div>
                    <div>
                      <strong>{c.full_name}</strong>
                      <small style={{ color: "#505660" }}>{c.title}</small>
                    </div>
                  </div>
                ))}
                {clients.length > 8 && (
                  <div style={{ padding: "10px 14px", fontSize: 8, color: "#505660", textAlign: "center" }}>
                    +{clients.length - 8} more members
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
