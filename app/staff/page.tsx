"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, Topbar } from "@/app/page";
import { getSessionUser, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { SessionEnrollment, Checkin, Profile, Membership } from "@/app/lib/supabase/types";

type CheckinWithProfile = Checkin & { profiles: Pick<Profile, "full_name" | "avatar_color" | "avatar_initials"> };
type ClientWithMembership = Profile & { memberships: Pick<Membership, "plan" | "status">[] };

const PLAN_PRICES: Record<string, number> = { basic: 2900, premium: 4900, vip: 9900 };
const PLAN_COLORS: Record<string, string> = { basic: "#7fa4f0", premium: "#c7fa00", vip: "#ffad3c" };
const PLAN_BG:     Record<string, string> = { basic: "rgba(127,164,240,.1)", premium: "rgba(199,250,0,.1)", vip: "rgba(255,173,60,.1)" };

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
  const [user, setUser]                   = useState<SessionUser | null>(null);
  const [sessions, setSessions]           = useState<SessionEnrollment[]>([]);
  const [checkins, setCheckins]           = useState<CheckinWithProfile[]>([]);
  const [clients, setClients]             = useState<ClientWithMembership[]>([]);
  const [loading, setLoading]             = useState(true);
  const [checkingIn, setCheckingIn]       = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  // assign plan modal
  const [assignTarget, setAssignTarget]   = useState<ClientWithMembership | null>(null);
  const [assignPlan, setAssignPlan]       = useState<"basic" | "premium" | "vip">("basic");
  const [assignExpiry, setAssignExpiry]   = useState("");
  const [assignSaving, setAssignSaving]   = useState(false);
  const [assignMsg, setAssignMsg]         = useState("");

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "staff") { router.push("/login"); return; }
    setUser(u);
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [sesRes, checkinRes, clientRes] = await Promise.all([
      supabase.from("session_enrollment").select("*").gte("starts_at", todayStart.toISOString()).lte("starts_at", todayEnd.toISOString()).order("starts_at"),
      supabase.from("checkins").select("*, profiles(full_name, avatar_color, avatar_initials)").gte("checked_in_at", todayStart.toISOString()).order("checked_in_at", { ascending: false }),
      supabase.from("profiles").select("*, memberships(plan, status)").eq("role", "client").order("full_name"),
    ]);

    if (sesRes.data)     setSessions(sesRes.data as SessionEnrollment[]);
    if (checkinRes.data) setCheckins(checkinRes.data as CheckinWithProfile[]);
    if (clientRes.data)  setClients(clientRes.data as ClientWithMembership[]);
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
    else { setSelectedClient(""); setSelectedSession(""); await fetchData(); }
    setCheckingIn(false);
  }

  function openAssign(c: ClientWithMembership) {
    const existing = c.memberships?.[0];
    setAssignTarget(c);
    setAssignPlan((existing?.plan as "basic" | "premium" | "vip") ?? "basic");
    setAssignExpiry("");
    setAssignMsg("");
  }

  async function handleAssignPlan() {
    if (!assignTarget) return;
    setAssignSaving(true);
    setAssignMsg("");
    const supabase = createClient();
    const existing = assignTarget.memberships?.[0];
    let error;
    if (existing) {
      ({ error } = await supabase.from("memberships")
        .update({ plan: assignPlan, expires_at: assignExpiry || null, price_cents: PLAN_PRICES[assignPlan] })
        .eq("client_id", assignTarget.id).eq("status", "active"));
    } else {
      ({ error } = await supabase.from("memberships").insert({
        client_id:   assignTarget.id,
        plan:        assignPlan,
        status:      "active",
        started_at:  new Date().toISOString().slice(0, 10),
        expires_at:  assignExpiry || null,
        price_cents: PLAN_PRICES[assignPlan],
      }));
    }
    if (error) { setAssignMsg("Error: " + error.message); }
    else {
      await supabase.from("invoices").insert({
        client_id:    assignTarget.id,
        description:  `${assignPlan.charAt(0).toUpperCase() + assignPlan.slice(1)} Membership`,
        amount_cents: PLAN_PRICES[assignPlan],
        status:       "pending",
        method:       "cash",
        due_at:       new Date().toISOString().slice(0, 10),
      });
      setAssignMsg(existing ? "Plan updated." : "Plan assigned.");
      await fetchData();
    }
    setAssignSaving(false);
  }

  if (!user) return null;

  return (
    <main className="dashboard-shell">
      <Sidebar active="staff" />
      <section className="content">
        <Topbar title="Staff Dashboard" />

        <div className="page-body">
          <div className="metrics">
            <Metric label="Classes Today"   value={loading ? "—" : String(sessions.length)}  delta="scheduled" note="today"       icon="▣" up />
            <Metric label="Check-ins Today" value={loading ? "—" : String(checkins.length)}  delta="recorded"  note="today"       icon="⌁" up />
            <Metric label="Members on File" value={loading ? "—" : String(clients.length)}   delta="clients"   note="total"       icon="♟" />
            <Metric label="Fully Booked"    value={loading ? "—" : String(sessions.filter(s=>Number(s.enrolled)>=s.capacity).length)} delta="today" note="at capacity" icon="◒" />
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
                  <h2>Today&apos;s Classes</h2>
                  <span className="hint">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : sessions.length === 0
                  ? <Empty message="No classes scheduled today" />
                  : sessions.map(s => {
                    const pct  = s.capacity > 0 ? Math.round(Number(s.enrolled) / s.capacity * 100) : 0;
                    const full = Number(s.enrolled) >= s.capacity;
                    const timeLabel = new Date(s.starts_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + "–" +
                      new Date(s.ends_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={s.session_id} style={{ display: "flex", gap: 10, padding: "13px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                        <div className={`class-line ${s.color}`} style={{ alignSelf: "stretch", minHeight: 50 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <strong style={{ fontSize: 11 }}>{s.title}</strong>
                            <span className="status-pill" style={{ background: full ? "rgba(227,100,100,.1)" : "rgba(199,250,0,.1)", color: full ? "#e36464" : "#c7fa00" }}>
                              {s.enrolled}/{s.capacity}{full ? " · FULL" : ""}
                            </span>
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
                  <h2>Today&apos;s Check-ins</h2>
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
                        <div className={`avatar avatar-${c.profiles?.avatar_color ?? "lime"}`}>{c.profiles?.avatar_initials ?? "?"}</div>
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

              {/* Members list with Assign Plan button */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Client Members</h2>
                  <span style={{ fontSize: 9, color: "#505660" }}>{clients.length} total</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : clients.length === 0
                  ? <Empty message="No client members found" />
                  : clients.slice(0, 10).map(c => {
                    const mem = c.memberships?.[0];
                    return (
                      <div key={c.id} className="member">
                        <div className={`avatar avatar-${c.avatar_color}`}>{c.avatar_initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{c.full_name}</strong>
                          <small style={{ color: "#505660" }}>
                            {mem ? <span style={{ color: PLAN_COLORS[mem.plan], fontWeight: 700, textTransform: "capitalize" }}>{mem.plan}</span> : "No plan"}
                          </small>
                        </div>
                        <button onClick={() => openAssign(c)} style={{
                          fontSize: 8, padding: "3px 9px", borderRadius: 4, cursor: "pointer", fontWeight: 600,
                          background: "rgba(199,250,0,.08)", border: "1px solid rgba(199,250,0,.2)", color: "#c7fa00",
                        }}>
                          {mem ? "Update" : "Assign"}
                        </button>
                      </div>
                    );
                  })
                }
                {clients.length > 10 && (
                  <div style={{ padding: "10px 14px", fontSize: 8, color: "#505660", textAlign: "center" }}>
                    +{clients.length - 10} more members
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Assign Plan Modal */}
      {assignTarget && (
        <div onClick={e => { if (e.target === e.currentTarget) setAssignTarget(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.75)" }}>
          <div className="panel" style={{ width: "min(400px,100%)", padding: 0, overflow: "hidden" }}>
            <div className="panel-heading">
              <h2>Assign Plan — {assignTarget.full_name}</h2>
              <button className="more" onClick={() => setAssignTarget(null)}>✕</button>
            </div>

            {assignTarget.memberships?.[0] && (
              <div style={{ padding: "10px 17px", background: "rgba(199,250,0,.04)", borderBottom: "1px solid var(--line)", fontSize: 9, color: "#505660" }}>
                Current: <span style={{ color: PLAN_COLORS[assignTarget.memberships[0].plan], fontWeight: 700, textTransform: "capitalize" }}>{assignTarget.memberships[0].plan}</span>
              </div>
            )}

            <div style={{ padding: "16px 17px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {(["basic", "premium", "vip"] as const).map(p => (
                  <button key={p} onClick={() => setAssignPlan(p)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                    background: assignPlan === p ? PLAN_BG[p] : "transparent",
                    border: `1px solid ${assignPlan === p ? PLAN_COLORS[p] + "60" : "var(--line)"}`,
                    color: assignPlan === p ? PLAN_COLORS[p] : "#505660",
                  }}>
                    {p}<br />
                    <span style={{ fontSize: 8, fontWeight: 400, opacity: .7 }}>${PLAN_PRICES[p] / 100}/mo</span>
                  </button>
                ))}
              </div>

              <div>
                <label style={{ fontSize: 9, color: "#9da1a5", fontWeight: 600, display: "block", marginBottom: 6 }}>Expiry Date (optional)</label>
                <input type="date" value={assignExpiry} onChange={e => setAssignExpiry(e.target.value)}
                  style={{ width: "100%", height: 36, background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 5, color: "#f2f3f1", fontSize: 10, padding: "0 10px", outline: "none", colorScheme: "dark" }} />
              </div>

              {assignMsg && (
                <p style={{ margin: 0, fontSize: 10, color: assignMsg.startsWith("Error") ? "#e36464" : "#00c9a7" }}>{assignMsg}</p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleAssignPlan} disabled={assignSaving} style={{
                  flex: 1, height: 38, borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: assignSaving ? "not-allowed" : "pointer",
                  background: "rgba(199,250,0,.1)", border: "1px solid rgba(199,250,0,.25)", color: "#c7fa00",
                  textTransform: "uppercase", letterSpacing: ".04em", opacity: assignSaving ? .6 : 1,
                }}>
                  {assignSaving ? "Saving…" : assignTarget.memberships?.[0] ? "Update Plan" : "Assign Plan"}
                </button>
                <button onClick={() => setAssignTarget(null)} style={{
                  height: 38, padding: "0 16px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: "transparent", border: "1px solid var(--line)", color: "#505660", cursor: "pointer",
                }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
