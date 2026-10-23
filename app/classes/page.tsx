"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar, Topbar } from "@/app/page";
import { createClient } from "@/app/lib/supabase/client";
import type { SessionEnrollment, Class, Profile, Trainer } from "@/app/lib/supabase/types";

type TrainerWithProfile = Partial<Trainer> & Pick<Profile, "id" | "full_name" | "avatar_color" | "avatar_initials">;
type ClassRow = Class;

const COLOR_BG: Record<string, string> = {
  red: "rgba(238,75,101,.12)", orange: "rgba(255,173,60,.12)", teal: "rgba(0,201,167,.12)",
  lime: "rgba(199,250,0,.12)", blue: "rgba(80,123,226,.12)", purple: "rgba(155,114,240,.12)",
};
const COLOR_TEXT: Record<string, string> = {
  red: "#ee4b65", orange: "#ffad3c", teal: "#00c9a7",
  lime: "#c7fa00", blue: "#7fa4f0", purple: "#b99af5",
};

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

export default function ClassesPage() {
  const [sessions, setSessions]   = useState<SessionEnrollment[]>([]);
  const [trainers, setTrainers]   = useState<TrainerWithProfile[]>([]);
  const [classes, setClasses]     = useState<ClassRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [pendingTrainer, setPendingTrainer] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [sesRes, profileRes, trainerRes, classRes] = await Promise.all([
      supabase.from("session_enrollment").select("*").gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(50),
      supabase.from("profiles").select("id, full_name, avatar_color, avatar_initials").eq("role", "trainer"),
      supabase.from("trainers").select("*"),
      supabase.from("classes").select("*").order("title"),
    ]);
    if (sesRes.data)   setSessions(sesRes.data as SessionEnrollment[]);
    if (classRes.data) setClasses(classRes.data as ClassRow[]);
    if (profileRes.data) {
      const trainerMap = new Map((trainerRes.data ?? []).map((t: Trainer) => [t.id, t]));
      setTrainers(profileRes.data.map(p => ({ ...trainerMap.get(p.id), ...p })) as TrainerWithProfile[]);
    }
    setLoading(false);
  }, []);

  async function assignTrainer(classId: string, trainerId: string) {
    setAssigning(classId);
    const supabase = createClient();
    if (trainerId) {
      // ensure a trainers row exists for this profile (FK requirement)
      await supabase.from("trainers").upsert({ id: trainerId }, { onConflict: "id", ignoreDuplicates: true });
    }
    const { error } = await supabase.from("classes").update({ trainer_id: trainerId || null }).eq("id", classId);
    if (error) { alert("Failed to assign: " + error.message); setAssigning(null); return; }
    setPendingTrainer(p => { const n = { ...p }; delete n[classId]; return n; });
    await fetchData();
    setAssigning(null);
  }

  useEffect(() => { fetchData(); }, [fetchData]);

  const todaySessions = sessions.filter(s => {
    const d = new Date(s.starts_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const fullyBooked = todaySessions.filter(s => Number(s.enrolled) >= s.capacity).length;
  const avgAttendance = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.capacity > 0 ? Number(s.enrolled) / s.capacity : 0), 0) / sessions.length * 100)
    : 0;

  return (
    <main className="dashboard-shell">
      <Sidebar active="classes" />
      <section className="content">
          <Topbar title="Classes &amp; Timetable" />

        <div className="page-body">
          <div className="metrics">
            <Metric label="Upcoming Sessions"  value={loading ? "—" : String(sessions.length)}      delta="next 7 days"  note="scheduled"    icon="▣" up />
            <Metric label="Avg. Attendance"    value={loading ? "—" : `${avgAttendance}%`}           delta="enrollment"   note="fill rate"    icon="◉" up />
            <Metric label="Active Trainers"    value={loading ? "—" : String(trainers.filter(t => t.status === "active").length)}  delta="on roster"  note="active"  icon="♙" />
            <Metric label="Fully Booked Today" value={loading ? "—" : String(fullyBooked)}           delta="today"        note="at capacity"  icon="⌁" />
          </div>

          {/* Assign trainers to classes */}
          <div className="panel">
            <div className="panel-heading">
              <h2>Assign Trainers to Classes</h2>
              <span className="hint">{classes.filter(c => !c.trainer_id).length} unassigned</span>
            </div>
            {loading
              ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
              : classes.filter(c => !c.trainer_id).length === 0
              ? <Empty message="All classes have a trainer assigned" />
              : (
              <table className="data-table">
                <thead>
                  <tr><th>Class</th><th>Room</th><th>Capacity</th><th>Assign Trainer</th></tr>
                </thead>
                <tbody>
                  {classes.filter(c => !c.trainer_id).map(cls => {
                    const pending = pendingTrainer[cls.id] ?? cls.trainer_id ?? "";
                    const isDirty = pending !== (cls.trainer_id ?? "");
                    return (
                    <tr key={cls.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className={`class-line ${cls.color}`} style={{ width: 3, height: 14, flexShrink: 0, borderRadius: 2 }} />
                          <span style={{ fontWeight: 600 }}>{cls.title}</span>
                        </div>
                      </td>
                      <td className="td-muted">{cls.room}</td>
                      <td className="td-muted">{cls.capacity}</td>
                      <td style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <select
                          value={pending}
                          disabled={assigning === cls.id}
                          onChange={e => setPendingTrainer(p => ({ ...p, [cls.id]: e.target.value }))}
                          style={{
                            flex: 1, background: "#0d0f11", border: `1px solid ${isDirty ? "rgba(199,250,0,.4)" : "var(--line)"}`, borderRadius: 5,
                            color: pending ? "#c0c5cb" : "#505660",
                            fontSize: 10, padding: "4px 8px", cursor: "pointer",
                            opacity: assigning === cls.id ? 0.5 : 1,
                          }}
                        >
                          <option value="">— Unassigned —</option>
                          {trainers.map(t => (
                            <option key={t.id} value={t.id}>{t.full_name} · {t.specialty ?? "—"}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => assignTrainer(cls.id, pending)}
                          disabled={assigning === cls.id || !isDirty}
                          style={{
                            flexShrink: 0, height: 28, padding: "0 10px", borderRadius: 4, fontSize: 8, fontWeight: 700,
                            cursor: assigning === cls.id || !isDirty ? "not-allowed" : "pointer",
                            background: isDirty ? "rgba(199,250,0,.1)" : "transparent",
                            border: `1px solid ${isDirty ? "rgba(199,250,0,.3)" : "var(--line)"}`,
                            color: isDirty ? "#c7fa00" : "#3a3e44",
                            opacity: assigning === cls.id ? 0.5 : 1,
                          }}
                        >
                          {assigning === cls.id ? "…" : "Save"}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
          </div>

          {/* Upcoming sessions table */}
          <div className="panel">
            <div className="panel-heading">
              <h2>Upcoming Sessions</h2>
              <span className="hint">{sessions.length} sessions loaded</span>
            </div>
            {loading
              ? <div style={{ padding: "32px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
              : sessions.length === 0
              ? <Empty message="No upcoming sessions" />
              : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>Class</th><th>Date &amp; Time</th><th>Trainer</th><th>Room</th><th>Enrolled</th><th>Capacity</th></tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const full = Number(s.enrolled) >= s.capacity;
                      const pct  = s.capacity > 0 ? Math.round(Number(s.enrolled) / s.capacity * 100) : 0;
                      const startDate = new Date(s.starts_at);
                      return (
                        <tr key={s.session_id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className={`class-line ${s.color}`} style={{ width: 3, height: 14, flexShrink: 0, borderRadius: 2 }} />
                              <span style={{ fontSize: 10, fontWeight: 600 }}>{s.title}</span>
                            </div>
                          </td>
                          <td className="td-muted">
                            {startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            {" · "}
                            {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="td-muted">{s.trainer_name ?? "—"}</td>
                          <td className="td-muted">{s.room}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className="prog-track" style={{ width: 60 }}>
                                <div className="prog-fill" style={{ width: `${pct}%`, background: full ? "#e36464" : COLOR_TEXT[s.color] ?? "#c7fa00" }} />
                              </div>
                              <span style={{ fontSize: 9, color: full ? "#e36464" : "#9da1a5" }}>{s.enrolled}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 9, fontWeight: 600, color: full ? "#e36464" : "#505660" }}>
                              {s.capacity}{full ? " · FULL" : ""}
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

          {/* Today's classes + Trainer load */}
          <div className="two-col-6040">
            <div className="panel">
              <div className="panel-heading">
                <h2>Today's Classes — Enrollment</h2>
                <span className="hint">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              </div>
              {loading
                ? <div style={{ padding: "32px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                : todaySessions.length === 0
                ? <Empty message="No classes scheduled today" />
                : todaySessions.map(s => {
                  const pct  = s.capacity > 0 ? Math.round(Number(s.enrolled) / s.capacity * 100) : 0;
                  const full = Number(s.enrolled) >= s.capacity;
                  const startDate = new Date(s.starts_at);
                  const endDate   = new Date(s.ends_at);
                  const timeLabel = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + "–" +
                    endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={s.session_id} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                      <div className={`class-line ${s.color}`} style={{ alignSelf: "stretch", minHeight: 40 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <strong style={{ fontSize: 10 }}>{s.title}</strong>
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 10,
                            background: full ? "rgba(227,100,100,.12)" : "rgba(199,250,0,.1)",
                            color: full ? "#e36464" : "#c7fa00",
                          }}>{s.enrolled}/{s.capacity}{full ? " · FULL" : ""}</span>
                        </div>
                        <small style={{ color: "#505660", fontSize: 8 }}>{timeLabel} · {s.trainer_name ?? "—"} · {s.room}</small>
                        <div style={{ marginTop: 6 }}>
                          <div className="prog-track">
                            <div className="prog-fill" style={{ width: `${pct}%`, background: full ? "#e36464" : COLOR_TEXT[s.color] ?? "#c7fa00" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="panel">
                <div className="panel-heading"><h2>Trainer Load</h2></div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : trainers.length === 0
                  ? <Empty message="No trainers found" />
                  : trainers.map(t => {
                    const trainerSessions = sessions.filter(s => s.trainer_name === t.full_name);
                    const util = Math.round((t.rating ?? 0) * 10);
                    const color = COLOR_TEXT[t.avatar_color ?? "lime"] ?? "#c7fa00";
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--line)" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#c0c5cb" }}>{t.full_name}</div>
                          <div style={{ fontSize: 8, color: "#505660", marginTop: 2 }}>{t.specialty ?? "—"} · {trainerSessions.length} upcoming sessions</div>
                        </div>
                        <div style={{ width: 70 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 7, color: "#505660" }}>Rating</span>
                            <span style={{ fontSize: 7, color }}>★ {t.rating ?? "—"}</span>
                          </div>
                          <div className="prog-track"><div className="prog-fill" style={{ width: `${util}%`, background: color }} /></div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <div className="panel">
                <div className="panel-heading"><h2>Quick Stats</h2></div>
                <div className="stat-row"><span className="label">Sessions This Week</span><span className="val lime">{sessions.length}</span></div>
                <div className="stat-row"><span className="label">Fully Booked Today</span><span className="val orange">{fullyBooked}</span></div>
                <div className="stat-row"><span className="label">Avg. Fill Rate</span><span className="val lime">{avgAttendance}%</span></div>
                <div className="stat-row"><span className="label">Active Trainers</span><span className="val">{trainers.length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
