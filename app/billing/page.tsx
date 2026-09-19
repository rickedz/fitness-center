"use client";

import { Sidebar } from "@/app/page";

export default function BillingPage() {
  return (
    <main className="dashboard-shell">
      <Sidebar active="billing" />
      <section className="content">
        <header className="topbar">
          <h1>Billing &amp; Payments</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search invoices..." /></label>
            <button className="status">● System Active</button>
          </div>
        </header>
        <div className="page-body">
          <div className="metrics">
            <Metric label="Total Billed" value="$48,290" delta="+8.2%" note="this month" icon="▱" />
            <Metric label="Collected" value="$44,470" delta="92.1%" note="collection rate" icon="◉" />
            <Metric label="Overdue" value="$3,820" delta="+$420" note="vs last month" icon="▤" negative />
            <Metric label="Refunds" value="$580" delta="-2" note="this month" icon="◒" negative />
          </div>

          <section className="panel" style={{ marginTop: 12 }}>
            <div className="panel-heading"><h2>Invoices</h2></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #26282b", color: "#9da1a5", textTransform: "uppercase" }}>
                  <th style={th}>Invoice #</th>
                  <th style={th}>Member</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Due Date</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                <InvoiceRow id="INV-1042" name="John Doe" plan="VIP Membership" amount="$99.00" due="Sep 15, 2026" status="Paid" />
                <InvoiceRow id="INV-1041" name="Sarah Connor" plan="Premium + PT" amount="$219.00" due="Sep 14, 2026" status="Paid" />
                <InvoiceRow id="INV-1040" name="James Smith" plan="Basic Membership" amount="$29.00" due="Sep 14, 2026" status="Paid" />
                <InvoiceRow id="INV-1039" name="Kevin Park" plan="Premium Membership" amount="$49.00" due="Sep 10, 2026" status="Overdue" overdue />
                <InvoiceRow id="INV-1038" name="Maria Lopez" plan="Class Pack (10)" amount="$75.00" due="Sep 8, 2026" status="Paid" />
                <InvoiceRow id="INV-1037" name="Nia Foster" plan="Basic Membership" amount="$29.00" due="Sep 5, 2026" status="Overdue" overdue />
                <InvoiceRow id="INV-1036" name="Derek Kim" plan="VIP Membership" amount="$99.00" due="Sep 1, 2026" status="Paid" />
                <InvoiceRow id="INV-1035" name="Ryan Patel" plan="Personal Training" amount="$120.00" due="Aug 30, 2026" status="Refunded" refunded />
              </tbody>
            </table>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <section className="panel">
              <div className="panel-heading"><h2>Payment Methods on File</h2></div>
              <div style={{ padding: "10px 12px 12px", display: "grid", gap: 8 }}>
                <PayMethod label="Visa •••• 4242" members={1240} pct={50} />
                <PayMethod label="Mastercard •••• 8871" members={742} pct={30} />
                <PayMethod label="GCash / E-Wallet" members={371} pct={15} />
                <PayMethod label="Cash" members={128} pct={5} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading"><h2>Subscription Plans</h2></div>
              <div style={{ padding: "10px 12px 12px", display: "grid", gap: 8 }}>
                <PlanRow name="Basic" price="$29/mo" members={980} color="#507be2" />
                <PlanRow name="Premium" price="$49/mo" members={1102} color="#c7fa00" />
                <PlanRow name="VIP" price="$99/mo" members={399} color="#ffad3c" />
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontWeight: 600 };

function InvoiceRow({ id, name, plan, amount, due, status, overdue = false, refunded = false }: { id: string; name: string; plan: string; amount: string; due: string; status: string; overdue?: boolean; refunded?: boolean }) {
  const color = overdue ? "#e36464" : refunded ? "#9da1a5" : "#c7fa00";
  return (
    <tr style={{ borderBottom: "1px solid #1e2022" }}>
      <td style={{ padding: "10px 12px", color: "#9da1a5" }}>{id}</td>
      <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: 9 }}>{name}</td>
      <td style={{ padding: "10px 12px", color: "#9da1a5" }}>{plan}</td>
      <td style={{ padding: "10px 12px", color: "#c7fa00" }}>{amount}</td>
      <td style={{ padding: "10px 12px", color: "#9da1a5" }}>{due}</td>
      <td style={{ padding: "10px 12px", color }}>{status}</td>
    </tr>
  );
}

function PayMethod({ label, members, pct }: { label: string; members: number; pct: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <small style={{ fontSize: 8, color: "#f3f4f2" }}>{label}</small>
        <small style={{ fontSize: 8, color: "#9da1a5" }}>{members} members · {pct}%</small>
      </div>
      <div style={{ background: "#26292b", borderRadius: 3, height: 4 }}>
        <div style={{ background: "#c7fa00", height: "100%", width: `${pct}%`, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function PlanRow({ name, price, members, color }: { name: string; price: string; members: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111214", border: "1px solid #24272a", borderRadius: 5, padding: "10px 12px" }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <strong style={{ fontSize: 9 }}>{name}</strong>
      <span style={{ fontSize: 8, color: "#9da1a5", marginLeft: "auto" }}>{members} members</span>
      <span style={{ fontSize: 9, color, fontWeight: 700 }}>{price}</span>
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
