"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/page";
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

function PlanCard({ name, price, members, revenue, color, pct }: { name: string; price: string; members: number; revenue: string; color: string; pct: number }) {
  return (
    <div style={{ background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 6, padding: "11px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <strong style={{ fontSize: 11 }}>{name}</strong>
            <span style={{ fontSize: 9, color: "#505660" }}>{price}</span>
          </div>
          <div style={{ fontSize: 8, color: "#505660", marginTop: 4 }}>{members.toLocaleString()} members</div>
        </div>
        <strong style={{ fontSize: 12, color }}>{revenue}<span style={{ fontSize: 8, fontWeight: 400, color: "#505660" }}>/mo</span></strong>
      </div>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
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

  const totalCents   = invoices.reduce((s, i) => s + i.amount_cents, 0);
  const paidCents    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount_cents, 0);
  const overdueCents = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount_cents, 0);
  const refundCents  = invoices.filter(i => i.status === "refunded").reduce((s, i) => s + i.amount_cents, 0);
  const collectionRate = totalCents > 0 ? ((paidCents / totalCents) * 100).toFixed(1) : "0.0";

  const fmt = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const overdueList  = invoices.filter(i => i.status === "overdue");
  const pendingList  = invoices.filter(i => i.status === "pending");

  return (
    <main className="dashboard-shell">
      <Sidebar active="billing" />
      <section className="content">
        <header className="topbar">
          <h1>Billing &amp; Payments</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search invoices…" /></label>
            <button className="status">System Active</button>
          </div>
        </header>

        <div className="page-body">
          <div className="metrics">
            <Metric label="Total Billed"  value={loading ? "—" : fmt(totalCents)}   delta={`${collectionRate}%`} note="collection rate" icon="▱" up />
            <Metric label="Collected"     value={loading ? "—" : fmt(paidCents)}    delta={`${invoices.filter(i=>i.status==="paid").length} invoices`} note="paid" icon="◉" up />
            <Metric label="Overdue"       value={loading ? "—" : fmt(overdueCents)} delta={`${overdueList.length} invoices`} note="need attention" icon="▤" />
            <Metric label="Refunds"       value={loading ? "—" : fmt(refundCents)}  delta={`${invoices.filter(i=>i.status==="refunded").length}`} note="this period" icon="◒" />
          </div>

          <div className="two-col">
            {/* Alerts */}
            <div className="panel">
              <div className="panel-heading">
                <h2>Overdue &amp; Alerts</h2>
                {overdueList.length > 0 && (
                  <span className="hint" style={{ color: "#e36464", fontSize: 8, fontWeight: 700 }}>{overdueList.length} overdue</span>
                )}
              </div>
              {overdueList.length === 0 && pendingList.length === 0
                ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#3a3e44", fontSize: 9 }}>No overdue or pending invoices</div>
                : <>
                  {overdueList.map(inv => (
                    <div key={inv.id} className="alert-strip">
                      <div className="alert-dot red" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#e36464" }}>{inv.profiles?.full_name} — {fmt(inv.amount_cents)} overdue</div>
                        <div className="alert-meta">{inv.description} · Due {new Date(inv.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      </div>
                      <button className="view-all" style={{ color: "#e36464", opacity: 1 }}>Remind</button>
                    </div>
                  ))}
                  {pendingList.map(inv => (
                    <div key={inv.id} className="alert-strip">
                      <div className="alert-dot orange" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#ffad3c" }}>{inv.profiles?.full_name} — {fmt(inv.amount_cents)} pending</div>
                        <div className="alert-meta">{inv.description} · Awaiting confirmation</div>
                      </div>
                      <button className="view-all" style={{ color: "#ffad3c", opacity: 1 }}>Follow up</button>
                    </div>
                  ))}
                </>
              }

              <div className="panel-heading" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", marginTop: 4 }}>
                <h2>Collection Summary</h2>
              </div>
              <div className="stat-row"><span className="label">Total Invoiced</span><span className="val">{fmt(totalCents)}</span></div>
              <div className="stat-row"><span className="label">Collected</span><span className="val lime">{fmt(paidCents)}</span></div>
              <div className="stat-row"><span className="label">Overdue</span><span className="val red">{fmt(overdueCents)}</span></div>
              <div className="stat-row"><span className="label">Refunds Issued</span><span className="val orange">{fmt(refundCents)}</span></div>
              <div className="stat-row"><span className="label">Collection Rate</span><span className="val lime">{collectionRate}%</span></div>
            </div>

            {/* Plan breakdown (static — driven by membership counts) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="panel">
                <div className="panel-heading"><h2>Subscription Plans</h2></div>
                <div style={{ padding: "6px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <PlanCard name="Basic"   price="$29/mo"  members={980}  revenue="$28,420" color="#7fa4f0" pct={40} />
                  <PlanCard name="Premium" price="$49/mo"  members={1102} revenue="$53,998" color="#c7fa00" pct={100} />
                  <PlanCard name="VIP"     price="$99/mo"  members={399}  revenue="$39,501" color="#ffad3c" pct={73} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading"><h2>Payment Methods on File</h2></div>
                {(["visa","mastercard","gcash","cash","other"] as const).map(method => {
                  const count = invoices.filter(i => i.method === method).length;
                  const pct = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0;
                  const colors: Record<string, string> = { visa: "#c7fa00", mastercard: "#c7fa00", gcash: "#507be2", cash: "#ffad3c", other: "#505660" };
                  if (count === 0) return null;
                  return (
                    <div key={method} className="prog-row">
                      <div className="prog-labels">
                        <span style={{ textTransform: "capitalize" }}>{method}</span>
                        <small>{count} invoices · {pct}%</small>
                      </div>
                      <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%`, background: colors[method] }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Full invoice table */}
          <div className="panel">
            <div className="panel-heading">
              <h2>All Invoices {!loading && <span style={{ color: "#505660", fontWeight: 400 }}>({invoices.length})</span>}</h2>
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
