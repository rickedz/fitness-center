"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, Topbar } from "@/app/page";
import { getSessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { Invoice, Profile } from "@/app/lib/supabase/types";

type InvoiceWithClient = Invoice & { profiles: Pick<Profile, "full_name"> };

const STATUS_MAP: Record<string, string> = {
  paid: "pill-paid", pending: "pill-pending", overdue: "pill-overdue", refunded: "pill-refunded",
};

function Metric({ label, value, delta, note, icon, up = false }: { label: string; value: string; delta: string; note: string; icon: string; up?: boolean }) {
  return (
    <article className="metric">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      <p className="metric-delta"><span className={up ? "up" : "down"}>{delta}</span><em>{note}</em></p>
    </article>
  );
}

function RevenueBar({ label, amount, pct, color }: { label: string; amount: string; pct: number; color: string }) {
  return (
    <div className="prog-row">
      <div className="prog-labels">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
          {label}
        </span>
        <small style={{ color: "#9da1a5", fontWeight: 600 }}>{amount}</small>
      </div>
      <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

export default function RevenuePage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "admin") { router.push("/login"); }
  }, [router]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("invoices")
      .select("*, profiles(full_name)")
      .order("due_at", { ascending: false });
    if (data) setInvoices(data as InvoiceWithClient[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const fmt = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const paidInvoices    = invoices.filter(i => i.status === "paid");
  const pendingInvoices = invoices.filter(i => i.status === "pending" || i.status === "overdue");
  const totalPaid       = paidInvoices.reduce((s, i) => s + i.amount_cents, 0);
  const totalPending    = pendingInvoices.reduce((s, i) => s + i.amount_cents, 0);
  const avgPerInvoice   = paidInvoices.length > 0 ? totalPaid / paidInvoices.length : 0;

  // Method breakdown
  const byMethod = (method: string) => invoices.filter(i => i.method === method && i.status === "paid").reduce((s, i) => s + i.amount_cents, 0);
  const visaCents  = byMethod("visa") + byMethod("mastercard");
  const gcashCents = byMethod("gcash");
  const cashCents  = byMethod("cash");
  const methodTotal = visaCents + gcashCents + cashCents || 1;

  return (
    <main className="dashboard-shell">
      <Sidebar active="revenue" />
      <section className="content">
          <Topbar title="Revenue" />

        <div className="page-body">
          <div className="metrics">
            <Metric label="Total Collected" value={loading ? "—" : fmt(totalPaid)}    delta={`${paidInvoices.length} invoices`} note="paid"          icon="▱" up />
            <Metric label="Pending / Overdue" value={loading ? "—" : fmt(totalPending)} delta={`${pendingInvoices.length} invoices`} note="outstanding" icon="◒" />
            <Metric label="Avg. per Invoice" value={loading ? "—" : fmt(avgPerInvoice)} delta="per paid invoice" note="average"                       icon="♟" up />
            <Metric label="Total Invoices"   value={loading ? "—" : String(invoices.length)} delta="all time" note="records"                          icon="▤" up />
          </div>

          <div className="two-col-6040">
            {/* Revenue trend chart (static shape, live labels) */}
            <div className="panel">
              <div className="panel-heading">
                <h2>Revenue Trend</h2>
                <div className="chart-controls">
                  <button className="selected">All Time</button>
                </div>
              </div>
              <div className="chart-area">
                <svg viewBox="0 0 600 110" aria-label="Revenue trend">
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c7fa00" stopOpacity=".16" />
                      <stop offset="100%" stopColor="#c7fa00" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[20,45,70,95].map(y => (
                    <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1a1d21" strokeWidth="1" />
                  ))}
                  <path d="M0 108 L50 96 L100 100 L150 86 L200 72 L250 58 L300 63 L350 48 L400 36 L450 24 L500 14 L550 8 L600 4" fill="url(#rg)" />
                  <path d="M0 108 L50 96 L100 100 L150 86 L200 72 L250 58 L300 63 L350 48 L400 36 L450 24 L500 14 L550 8 L600 4" fill="none" stroke="#c7fa00" strokeWidth="2" strokeLinejoin="round" />
                  {([[0,108],[50,96],[100,100],[150,86],[200,72],[250,58],[300,63],[350,48],[400,36],[450,24],[500,14],[550,8],[600,4]] as [number,number][]).map(([x,y],i) => (
                    <circle key={i} cx={x} cy={y} r="3" fill="#c7fa00" opacity=".7" />
                  ))}
                </svg>
              </div>
              <div className="chart-months">
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => <span key={m}>{m}</span>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: "1px solid var(--line)" }}>
                {[
                  { label: "Total Collected", val: fmt(totalPaid) },
                  { label: "Avg / Invoice",   val: fmt(avgPerInvoice) },
                  { label: "Pending",         val: fmt(totalPending) },
                ].map(s => (
                  <div key={s.label} style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 8, color: "#505660", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#c7fa00" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Method breakdown */}
              <div className="panel">
                <div className="panel-heading"><h2>Payment Methods</h2></div>
                <RevenueBar label="Visa / Mastercard" amount={fmt(visaCents)}  pct={Math.round(visaCents/methodTotal*100)}  color="#c7fa00" />
                <RevenueBar label="GCash / E-Wallet"  amount={fmt(gcashCents)} pct={Math.round(gcashCents/methodTotal*100)} color="#507be2" />
                <RevenueBar label="Cash"              amount={fmt(cashCents)}  pct={Math.round(cashCents/methodTotal*100)}  color="#ffad3c" />
              </div>

              {/* Status breakdown */}
              <div className="panel">
                <div className="panel-heading"><h2>Invoice Status</h2></div>
                <div className="stat-row"><span className="label">Paid</span><span className="val lime">{paidInvoices.length}</span></div>
                <div className="stat-row"><span className="label">Pending</span><span className="val orange">{invoices.filter(i=>i.status==="pending").length}</span></div>
                <div className="stat-row"><span className="label">Overdue</span><span className="val red">{invoices.filter(i=>i.status==="overdue").length}</span></div>
                <div className="stat-row"><span className="label">Refunded</span><span className="val">{invoices.filter(i=>i.status==="refunded").length}</span></div>
              </div>
            </div>
          </div>

          {/* Transactions table */}
          <div className="panel">
            <div className="panel-heading">
              <h2>All Transactions {!loading && <span style={{ color: "#505660", fontWeight: 400 }}>({invoices.length})</span>}</h2>
              <button className="view-all">Export CSV</button>
            </div>
            {loading
              ? <div style={{ padding: "32px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
              : (
              <table className="data-table">
                <thead>
                  <tr><th>Member</th><th>Description</th><th>Amount</th><th>Due Date</th><th>Method</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="td-bold">{inv.profiles?.full_name ?? "—"}</td>
                      <td className="td-muted">{inv.description}</td>
                      <td className="td-lime">{fmt(inv.amount_cents)}</td>
                      <td className="td-muted">{new Date(inv.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="td-muted" style={{ textTransform: "capitalize" }}>{inv.method}</td>
                      <td><span className={`status-pill ${STATUS_MAP[inv.status]}`}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
          </div>
        </div>
      </section>
    </main>
  );
}
