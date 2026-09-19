"use client";

import { Sidebar } from "@/app/page";

export default function RevenuePage() {
  return (
    <main className="dashboard-shell">
      <Sidebar active="revenue" />
      <section className="content">
        <header className="topbar">
          <h1>Revenue</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search transactions..." /></label>
            <button className="status">● System Active</button>
          </div>
        </header>
        <div className="page-body">
          <div className="metrics">
            <Metric label="Monthly Revenue" value="$48,290" delta="+8.2%" note="vs last month" icon="▱" />
            <Metric label="Annual Revenue" value="$521,440" delta="+11.5%" note="vs last year" icon="▱" />
            <Metric label="Avg. per Member" value="$19.46" delta="+3.1%" note="vs last month" icon="◒" />
            <Metric label="Pending Payments" value="$3,820" delta="-5.4%" note="vs last month" icon="▤" negative />
          </div>

          <div className="main-grid" style={{ gridTemplateColumns: "1fr" }}>
            <section className="panel chart-panel" style={{ height: "auto", paddingBottom: 16 }}>
              <div className="panel-heading">
                <h2>Revenue Trend</h2>
                <div className="chart-controls"><button className="selected">YoY</button><button>Month</button></div>
              </div>
              <div className="chart">
                <div className="chart-grid">
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => <span key={m}>{m}</span>)}
                </div>
                <svg viewBox="0 0 720 130" role="img" aria-label="Revenue trend">
                  <path d="M0 110 L65 98 L130 102 L195 88 L260 75 L325 60 L390 65 L455 50 L520 38 L585 25 L650 15 L720 5" fill="none" stroke="#c7fa00" strokeWidth="2" />
                </svg>
              </div>
            </section>

            <section className="panel" style={{ marginTop: 12 }}>
              <div className="panel-heading"><h2>Recent Transactions</h2></div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #26282b", color: "#9da1a5", textTransform: "uppercase" }}>
                    <th style={th}>Member</th><th style={th}>Type</th><th style={th}>Amount</th><th style={th}>Date</th><th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <TxRow name="John Doe" type="Membership" amount="$49.00" date="Sep 13, 2026" status="Paid" />
                  <TxRow name="Sarah Connor" type="Personal Training" amount="$120.00" date="Sep 12, 2026" status="Paid" />
                  <TxRow name="James Smith" type="Membership" amount="$29.00" date="Sep 12, 2026" status="Paid" />
                  <TxRow name="Maria Lopez" type="Class Pack" amount="$75.00" date="Sep 11, 2026" status="Paid" />
                  <TxRow name="Kevin Park" type="Membership" amount="$49.00" date="Sep 10, 2026" status="Pending" pending />
                  <TxRow name="Nia Foster" type="Personal Training" amount="$120.00" date="Sep 10, 2026" status="Paid" />
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontWeight: 600 };

function TxRow({ name, type, amount, date, status, pending = false }: { name: string; type: string; amount: string; date: string; status: string; pending?: boolean }) {
  return (
    <tr style={{ borderBottom: "1px solid #1e2022" }}>
      <td style={{ padding: "10px 12px", fontSize: 9, fontWeight: 600 }}>{name}</td>
      <td style={{ padding: "10px 12px", fontSize: 9, color: "#9da1a5" }}>{type}</td>
      <td style={{ padding: "10px 12px", fontSize: 9, color: "#c7fa00" }}>{amount}</td>
      <td style={{ padding: "10px 12px", fontSize: 9, color: "#9da1a5" }}>{date}</td>
      <td style={{ padding: "10px 12px", fontSize: 9, color: pending ? "#ffad3c" : "#c7fa00" }}>{status}</td>
    </tr>
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
