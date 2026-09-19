"use client";

import { Sidebar } from "@/app/page";

export default function ClassesPage() {
  return (
    <main className="dashboard-shell">
      <Sidebar active="classes" />
      <section className="content">
        <header className="topbar">
          <h1>Classes &amp; Timetable</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search classes..." /></label>
            <button className="status">● System Active</button>
          </div>
        </header>
        <div className="page-body">
          <div className="metrics">
            <Metric label="Total Classes" value="24" delta="+2" note="vs last week" icon="▣" />
            <Metric label="Avg. Attendance" value="87.3%" delta="+4.1%" note="vs last week" icon="◉" />
            <Metric label="Active Instructors" value="8" delta="0" note="no change" icon="♙" />
            <Metric label="Cancelled Today" value="1" delta="+1" note="vs yesterday" icon="✕" negative />
          </div>

          <section className="panel" style={{ marginTop: 12 }}>
            <div className="panel-heading"><h2>Weekly Timetable</h2></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #26282b", color: "#9da1a5", textTransform: "uppercase" }}>
                    {["Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => (
                      <th key={d} style={th}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <TimetableRow time="06:00 AM" cells={["CrossFit WOD", "—", "CrossFit WOD", "—", "CrossFit WOD", "Boot Camp", "—"]} />
                  <TimetableRow time="09:00 AM" cells={["HIIT Performance", "Spin Cycle", "HIIT Performance", "Spin Cycle", "HIIT Performance", "Ashtanga Yoga", "HIIT Performance"]} />
                  <TimetableRow time="11:30 AM" cells={["Power Boxing", "—", "Power Boxing", "Pilates", "Power Boxing", "—", "Power Boxing"]} />
                  <TimetableRow time="05:00 PM" cells={["Ashtanga Yoga", "Zumba", "Ashtanga Yoga", "Zumba", "Ashtanga Yoga", "—", "—"]} />
                  <TimetableRow time="07:00 PM" cells={["CrossFit WOD", "Pilates", "CrossFit WOD", "Pilates", "CrossFit WOD", "—", "—"]} />
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ marginTop: 12 }}>
            <div className="panel-heading"><h2>Today&apos;s Classes</h2></div>
            <div style={{ padding: "8px 12px 12px", display: "grid", gap: 8 }}>
              <ClassRow title="HIIT Performance" time="09:00 – 10:00 AM" instructor="Coach Marcus" room="Studio A" enrolled="10/12" color="red" />
              <ClassRow title="Power Boxing" time="11:30 – 12:30 PM" instructor="Coach Victor" room="Combat Ring" enrolled="9/15" color="orange" />
              <ClassRow title="Ashtanga Yoga" time="05:00 – 06:00 PM" instructor="Elena Petrova" room="Mind & Body" enrolled="15/25" color="teal" />
              <ClassRow title="CrossFit WOD" time="07:00 – 08:00 PM" instructor="Coach Marcus" room="Studio B" enrolled="22/22" color="lime" />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontWeight: 600 };

function TimetableRow({ time, cells }: { time: string; cells: string[] }) {
  return (
    <tr style={{ borderBottom: "1px solid #1e2022" }}>
      <td style={{ padding: "10px 12px", color: "#9da1a5", fontWeight: 600 }}>{time}</td>
      {cells.map((c, i) => (
        <td key={i} style={{ padding: "10px 12px", color: c === "—" ? "#3a3e42" : "#f3f4f2" }}>{c}</td>
      ))}
    </tr>
  );
}

function ClassRow({ title, time, instructor, room, enrolled, color }: { title: string; time: string; instructor: string; room: string; enrolled: string; color: string }) {
  return (
    <div className="class-item">
      <div className={`class-line ${color}`} />
      <div>
        <strong>{title}</strong>
        <small>{time}</small>
        <small>{instructor} · {room}</small>
      </div>
      <span style={{ marginLeft: "auto" }}>{enrolled}</span>
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
