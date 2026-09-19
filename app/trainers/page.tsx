"use client";

import { Sidebar } from "@/app/page";

export default function TrainersPage() {
  return (
    <main className="dashboard-shell">
      <Sidebar active="trainers" />
      <section className="content">
        <header className="topbar">
          <h1>Trainer Roster</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search trainers..." /></label>
            <button className="status">● System Active</button>
          </div>
        </header>
        <div className="page-body">
          <div className="metrics">
            <Metric label="Total Trainers" value="8" delta="0" note="no change" icon="♙" />
            <Metric label="Hours This Week" value="312 hrs" delta="+18 hrs" note="vs last week" icon="◒" />
            <Metric label="Avg. Utilization" value="75%" delta="+5%" note="vs last month" icon="▣" />
            <Metric label="Open Slots" value="14" delta="-3" note="vs last week" icon="▱" negative />
          </div>

          <section className="panel" style={{ marginTop: 12 }}>
            <div className="panel-heading"><h2>All Trainers</h2></div>
            <div style={{ padding: "8px 12px 12px", display: "grid", gap: 10 }}>
              <TrainerCard initials="MA" color="orange" name="Coach Marcus" specialty="CrossFit / HIIT" hours="62 hrs" sessions={22} util={82} />
              <TrainerCard initials="VC" color="red" name="Coach Victor" specialty="Boxing / Combat" hours="48 hrs" sessions={16} util={70} />
              <TrainerCard initials="EP" color="blue" name="Elena Petrova" specialty="Yoga / Pilates" hours="44 hrs" sessions={18} util={68} />
              <TrainerCard initials="DK" color="lime" name="Derek Kim" specialty="Personal Training" hours="58 hrs" sessions={24} util={88} />
              <TrainerCard initials="NF" color="orange" name="Nia Foster" specialty="Zumba / Dance" hours="36 hrs" sessions={12} util={55} />
              <TrainerCard initials="RP" color="red" name="Ryan Patel" specialty="Spin / Cycling" hours="40 hrs" sessions={14} util={60} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function TrainerCard({ initials, color, name, specialty, hours, sessions, util }: { initials: string; color: string; name: string; specialty: string; hours: string; sessions: number; util: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#111214", border: "1px solid #24272a", borderRadius: 5, padding: "12px 14px" }}>
      <div className={`avatar avatar-${color}`} style={{ width: 34, height: 34, fontSize: 10, flex: "0 0 34px" }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 10, display: "block" }}>{name}</strong>
        <small style={{ color: "#74797e", fontSize: 8 }}>{specialty}</small>
      </div>
      <div style={{ textAlign: "center", minWidth: 55 }}>
        <strong style={{ fontSize: 10 }}>{hours}</strong>
        <small style={{ display: "block", color: "#74797e", fontSize: 7, marginTop: 2 }}>This Week</small>
      </div>
      <div style={{ textAlign: "center", minWidth: 45 }}>
        <strong style={{ fontSize: 10 }}>{sessions}</strong>
        <small style={{ display: "block", color: "#74797e", fontSize: 7, marginTop: 2 }}>Sessions</small>
      </div>
      <div style={{ minWidth: 90 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <small style={{ color: "#74797e", fontSize: 7 }}>Utilization</small>
          <small style={{ color: "#c7fa00", fontSize: 7 }}>{util}%</small>
        </div>
        <div style={{ background: "#26292b", borderRadius: 3, height: 4, overflow: "hidden" }}>
          <div style={{ background: "#c7fa00", height: "100%", width: `${util}%`, borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, delta, note, icon, negative = false }: { label: string; value: string; delta: string; note: string; icon: string; negative?: boolean }) {
  return (
    <article className="metric">
      <div className="metric-top"><span>{label}</span><b>{icon}</b></div>
      <strong>{value}</strong>
      <p className={negative ? "negative" : ""}>{delta} <em>{note}</em></p>
    </article>
  );
}
