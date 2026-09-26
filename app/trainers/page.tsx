"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/app/page";
import { createClient } from "@/app/lib/supabase/client";
import type { Trainer, Profile, SessionEnrollment } from "@/app/lib/supabase/types";

type TrainerRow = Trainer & { profiles: Pick<Profile, "full_name" | "avatar_color" | "avatar_initials"> };

const COLOR_HEX: Record<string, string> = {
  lime: "#c7fa00", orange: "#ffad3c", red: "#ee4b65",
  blue: "#7fa4f0", teal: "#00c9a7", purple: "#b99af5",
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

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [sessions, setSessions] = useState<SessionEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [trainerRes, sesRes] = await Promise.all([
      supabase.from("trainers").select("*, profiles(full_name, avatar_color, avatar_initials)"),
      supabase.from("session_enrollment").select("*").gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(20),
    ]);
    if (trainerRes.data) setTrainers(trainerRes.data as TrainerRow[]);
    if (sesRes.data)     setSessions(sesRes.data as SessionEnrollment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgRating = trainers.length > 0
    ? (trainers.reduce((s, t) => s + Number(t.rating), 0) / trainers.length).toFixed(1)
    : "—";

  const todaySessions = sessions.filter(s => new Date(s.starts_at).toDateString() === new Date().toDateString());

  return (
    <main className="dashboard-shell">
      <Sidebar active="trainers" />
      <section className="content">
        <header className="topbar">
          <h1>Trainer Roster</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search trainers…" /></label>
            <button className="status">System Active</button>
          </div>
        </header>

        <div className="page-body">
          <div className="metrics">
            <Metric label="Total Trainers"   value={loading ? "—" : String(trainers.length)}                                                  delta="on roster"    note="all statuses" icon="♙" up />
            <Metric label="Active Trainers"  value={loading ? "—" : String(trainers.filter(t=>t.status==="active").length)}                   delta="active"       note="available"    icon="◒" up />
            <Metric label="Avg. Rating"      value={loading ? "—" : `★ ${avgRating}`}                                                         delta="overall"      note="avg score"    icon="▣" up />
            <Metric label="Sessions Today"   value={loading ? "—" : String(todaySessions.length)}                                             delta="today"        note="scheduled"    icon="⌁" up />
          </div>

          <div className="two-col-6040">
            {/* Roster table */}
            <div className="panel">
              <div className="panel-heading">
                <h2>All Trainers</h2>
                <span className="hint">{trainers.length} on roster</span>
              </div>
              {loading
                ? <div style={{ padding: "32px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                : trainers.length === 0
                ? <Empty message="No trainers on roster" />
                : (
                <table className="data-table">
                  <thead>
                    <tr><th>Trainer</th><th>Specialty</th><th>Rating</th><th>Sessions</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {trainers.map(t => {
                      const color = COLOR_HEX[t.profiles?.avatar_color ?? "lime"] ?? "#c7fa00";
                      const trainerSessions = sessions.filter(s => s.trainer_name === t.profiles?.full_name);
                      return (
                        <tr key={t.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div className={`avatar avatar-${t.profiles?.avatar_color ?? "lime"}`} style={{ fontSize: 8 }}>
                                {t.profiles?.avatar_initials ?? "?"}
                              </div>
                              <strong style={{ fontSize: 10 }}>{t.profiles?.full_name ?? "—"}</strong>
                            </div>
                          </td>
                          <td className="td-muted">{t.specialty}</td>
                          <td><span style={{ color: "#ffad3c", fontSize: 9, fontWeight: 700 }}>★ {t.rating}</span></td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div className="prog-track" style={{ flex: 1 }}>
                                <div className="prog-fill" style={{ width: `${Math.min(trainerSessions.length * 10, 100)}%`, background: color }} />
                              </div>
                              <span style={{ fontSize: 8, color, fontWeight: 600, whiteSpace: "nowrap" }}>{trainerSessions.length}</span>
                            </div>
                          </td>
                          <td>
                            <span className="status-pill" style={{
                              background: t.status === "active" ? "rgba(199,250,0,.1)" : "rgba(255,255,255,.05)",
                              color: t.status === "active" ? "#c7fa00" : "#7a8088",
                            }}>{t.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Today's sessions */}
              <div className="panel">
                <div className="panel-heading">
                  <h2>Today's Sessions</h2>
                  <span className="hint">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                </div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : todaySessions.length === 0
                  ? <Empty message="No sessions scheduled today" />
                  : todaySessions.map(s => {
                    const startDate = new Date(s.starts_at);
                    return (
                      <div key={s.session_id} className="alert-strip">
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1d21", border: "1px solid var(--line)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 8, color: "#c7fa00", fontWeight: 700 }}>
                            {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(" AM","").replace(" PM","")}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#c0c5cb" }}>{s.title}</div>
                          <div className="alert-meta">{s.trainer_name ?? "—"} · {s.room} · {s.enrolled}/{s.capacity}</div>
                        </div>
                        <span style={{ fontSize: 8, color: "#505660", whiteSpace: "nowrap" }}>
                          {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                }
              </div>

              {/* Performance summary */}
              <div className="panel">
                <div className="panel-heading"><h2>Performance Summary</h2></div>
                {trainers.length > 0 && (() => {
                  const top = [...trainers].sort((a, b) => Number(b.rating) - Number(a.rating))[0];
                  return (
                    <>
                      <div className="stat-row"><span className="label">Highest Rated</span><span className="val lime">{top.profiles?.full_name} · ★ {top.rating}</span></div>
                      <div className="stat-row"><span className="label">Active Trainers</span><span className="val">{trainers.filter(t=>t.status==="active").length}</span></div>
                      <div className="stat-row"><span className="label">Part-time</span><span className="val">{trainers.filter(t=>t.status==="part-time").length}</span></div>
                      <div className="stat-row"><span className="label">Sessions Today</span><span className="val lime">{todaySessions.length}</span></div>
                      <div className="stat-row"><span className="label">Upcoming Sessions</span><span className="val">{sessions.length}</span></div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
