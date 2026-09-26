"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getSessionUser, ROLE_COOKIE, SESSION_KEY, clearSessionUser, type Role, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { Profile, SessionEnrollment, Checkin } from "@/app/lib/supabase/types";

type CheckinWithProfile = Checkin & { profiles: Pick<Profile, "full_name" | "avatar_color" | "avatar_initials"> };

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions]   = useState<SessionEnrollment[]>([]);
  const [checkins, setCheckins]   = useState<CheckinWithProfile[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [revenue, setRevenue]     = useState<number | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "admin") { router.push("/login"); }
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

    const [sesRes, checkinRes, memberRes, revenueRes] = await Promise.all([
      supabase.from("session_enrollment").select("*").gte("starts_at", todayStart.toISOString()).lte("starts_at", todayEnd.toISOString()).order("starts_at"),
      supabase.from("checkins").select("*, profiles(full_name, avatar_color, avatar_initials)").gte("checked_in_at", todayStart.toISOString()).order("checked_in_at", { ascending: false }).limit(6),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
      supabase.from("invoices").select("amount_cents").eq("status", "paid"),
    ]);

    if (sesRes.data)     setSessions(sesRes.data as SessionEnrollment[]);
    if (checkinRes.data) setCheckins(checkinRes.data as CheckinWithProfile[]);
    if (memberRes.count !== null) setMemberCount(memberRes.count);
    if (revenueRes.data) setRevenue(revenueRes.data.reduce((s, i) => s + i.amount_cents, 0));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
  const avgAttendance = sessions.length > 0
    ? Math.round(sessions.reduce((s, ses) => s + (ses.capacity > 0 ? Number(ses.enrolled) / ses.capacity : 0), 0) / sessions.length * 100)
    : 0;

  return (
    <main className="dashboard-shell">
      <Sidebar active="dashboard" />
      <section className="content">
        <header className="topbar">
          <h1>Executive Dashboard</h1>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search members, classes…" /></label>
            <button className="status">System Active</button>
            <button className="icon-button" aria-label="Notifications">🔔</button>
          </div>
        </header>

        <div className="page-body">
          <div className="metrics">
            <Metric label="Active Members"   value={loading ? "—" : String(memberCount ?? 0)} delta="clients"    note="on record"     icon="♟" up />
            <Metric label="Total Revenue"    value={loading ? "—" : fmt(revenue ?? 0)}        delta="collected"  note="all paid"      icon="▱" up />
            <Metric label="Check-ins Today"  value={loading ? "—" : String(checkins.length)}  delta="today"      note="recorded"      icon="⌁" up />
            <Metric label="Class Attendance" value={loading ? "—" : `${avgAttendance}%`}      delta="fill rate"  note="today's avg"   icon="▣" />
          </div>

          <div className="two-col-7030">
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Membership Growth &amp; Acquisition</h2>
                  <div className="chart-controls">
                    <button className="selected">YoY</button><button>Month</button><button>Week</button>
                  </div>
                </div>
                <div className="chart-area">
                  <svg viewBox="0 0 720 110" aria-label="Membership growth trend">
                    <defs>
                      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c7fa00" stopOpacity=".18" />
                        <stop offset="100%" stopColor="#c7fa00" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[20,45,70,95].map(y=><line key={y} x1="0" y1={y} x2="720" y2={y} stroke="#1a1d21" strokeWidth="1"/>)}
                    <path d="M0 93 L60 87 L120 90 L180 82 L240 74 L300 61 L360 66 L420 53 L480 42 L540 32 L600 22 L660 14 L720 8" fill="url(#lg)" stroke="none"/>
                    <path d="M0 93 L60 87 L120 90 L180 82 L240 74 L300 61 L360 66 L420 53 L480 42 L540 32 L600 22 L660 14 L720 8" fill="none" stroke="#c7fa00" strokeWidth="2" strokeLinejoin="round"/>
                    {([[0,93],[60,87],[120,90],[180,82],[240,74],[300,61],[360,66],[420,53],[480,42],[540,32],[600,22],[660,14],[720,8]] as [number,number][]).map(([x,y],i)=>(
                      <circle key={i} cx={x} cy={y} r="3" fill="#c7fa00" opacity=".7"/>
                    ))}
                  </svg>
                </div>
                <div className="chart-months">
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m=><span key={m}>{m}</span>)}
                </div>
              </div>

              <div className="two-col">
                {/* Recent check-ins */}
                <div className="panel">
                  <div className="panel-heading"><h2>Recent Check-ins</h2><button className="view-all">View all</button></div>
                  {loading
                    ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                    : checkins.length === 0
                    ? <div style={{ padding: "32px 14px", textAlign: "center", color: "#3a3e44", fontSize: 9 }}>No check-ins today</div>
                    : (
                    <div className="member-list">
                      {checkins.map(c => (
                        <div key={c.id} className="member">
                          <div className={`avatar avatar-${c.profiles?.avatar_color ?? "lime"}`}>{c.profiles?.avatar_initials ?? "?"}</div>
                          <div>
                            <strong>{c.profiles?.full_name ?? "—"}</strong>
                            <small><span className="member-badge badge-basic">{c.session_id ? "class" : "walk-in"}</span></small>
                          </div>
                          <time>{new Date(c.checked_in_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</time>
                        </div>
                      ))}
                    </div>
                    )}
                </div>

                {/* Trainer utilization (static) */}
                <div className="panel">
                  <div className="panel-heading"><h2>Trainer Utilization</h2><button className="more">•••</button></div>
                  <div className="donut-section">
                    <div className="donut"><strong>75%</strong><span>Used</span></div>
                    <div className="donut-legend">
                      <span><i className="i i-lime"/>PT Sessions<b> (45 hrs)</b></span>
                      <span><i className="i i-blue"/>Group Classes<b> (15 hrs)</b></span>
                      <span><i className="i i-orange"/>Consultations<b> (6 hrs)</b></span>
                    </div>
                  </div>
                  <div className="prog-row"><div className="prog-labels"><span>Coach Marcus</span><small>82%</small></div><div className="prog-track"><div className="prog-fill" style={{width:"82%",background:"#c7fa00"}}/></div></div>
                  <div className="prog-row"><div className="prog-labels"><span>Coach Victor</span><small>70%</small></div><div className="prog-track"><div className="prog-fill" style={{width:"70%",background:"#507be2"}}/></div></div>
                  <div className="prog-row"><div className="prog-labels"><span>Elena Petrova</span><small>68%</small></div><div className="prog-track"><div className="prog-fill" style={{width:"68%",background:"#00c9a7"}}/></div></div>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Today's schedule */}
              <div className="panel">
                <div className="panel-heading"><h2>Today's Schedule</h2><button className="view-all">View all</button></div>
                {loading
                  ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>Loading…</div>
                  : sessions.length === 0
                  ? <div style={{ padding: "32px 14px", textAlign: "center", color: "#3a3e44", fontSize: 9 }}>No classes today</div>
                  : (
                  <div className="class-list">
                    {sessions.map(s => {
                      const startDate = new Date(s.starts_at);
                      const endDate   = new Date(s.ends_at);
                      const timeLabel = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + "–" +
                        endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={s.session_id} className="class-item">
                          <div className={`class-line ${s.color}`}/>
                          <div><strong>{s.title}</strong><small>{timeLabel}</small><small>{s.trainer_name ?? "—"} · {s.room}</small></div>
                          <span className="class-tag">{s.enrolled}/{s.capacity}</span>
                        </div>
                      );
                    })}
                  </div>
                  )}
              </div>

              {/* Quick stats */}
              <div className="panel">
                <div className="panel-heading"><h2>Quick Stats</h2></div>
                <div className="stat-row"><span className="label">Client Members</span><span className="val lime">{memberCount ?? "—"}</span></div>
                <div className="stat-row"><span className="label">Total Revenue</span><span className="val lime">{revenue !== null ? fmt(revenue) : "—"}</span></div>
                <div className="stat-row"><span className="label">Check-ins Today</span><span className="val">{checkins.length}</span></div>
                <div className="stat-row"><span className="label">Classes Today</span><span className="val">{sessions.length}</span></div>
                <div className="stat-row"><span className="label">Avg. Fill Rate</span><span className="val lime">{avgAttendance}%</span></div>
                <div className="stat-row"><span className="label">Fully Booked</span><span className="val orange">{sessions.filter(s=>Number(s.enrolled)>=s.capacity).length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ── Role-aware nav config ─────────────────────────────────────────────────────

const NAV_BY_ROLE: Record<Role, { href:string; label:string; icon:string; key:string }[]> = {
  admin: [
    { href:"/",            label:"Dashboard",          icon:"◉", key:"dashboard"  },
    { href:"/revenue",     label:"Revenue",            icon:"◒", key:"revenue"    },
    { href:"/classes",     label:"Classes & Timetable",icon:"▣", key:"classes"    },
    { href:"/trainers",    label:"Trainer Roster",     icon:"♙", key:"trainers"   },
    { href:"/billing",     label:"Billing & Payments", icon:"▤", key:"billing"    },
    { href:"/admin/users", label:"User Management",    icon:"⊞", key:"users"      },
  ],
  staff: [
    { href:"/staff",    label:"My Dashboard",       icon:"◉", key:"staff"    },
    { href:"/classes",  label:"Classes & Timetable",icon:"▣", key:"classes"  },
    { href:"/trainers", label:"Trainer Roster",     icon:"♙", key:"trainers" },
  ],
  client: [
    { href:"/client", label:"My Dashboard", icon:"◉", key:"client" },
  ],
};

const ROLE_LABEL: Record<Role, string> = { admin:"Admin", staff:"Staff", client:"Client" };
const ROLE_COLOR: Record<Role, string> = { admin:"#c7fa00", staff:"#ffad3c", client:"#7fa4f0" };
const ROLE_BG:    Record<Role, string> = {
  admin:"rgba(199,250,0,.1)", staff:"rgba(255,173,60,.1)", client:"rgba(127,164,240,.1)",
};

// ── Shared Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar({ active }: { active: string }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => { setUser(getSessionUser()); }, []);

  const role: Role = user?.role ?? "client";
  const links = NAV_BY_ROLE[role];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = `${ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    clearSessionUser();
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span>GRITFIT<small>FITNESS CENTER</small></span>
      </div>

      {user && (
        <div style={{ margin:"-18px 3px 20px", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            fontSize:7, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase",
            padding:"3px 8px", borderRadius:10,
            background: ROLE_BG[role], color: ROLE_COLOR[role],
            border:`1px solid ${ROLE_COLOR[role]}30`,
          }}>
            {ROLE_LABEL[role]}
          </span>
        </div>
      )}

      <nav className="nav-list" aria-label="Main navigation">
        {links.map(l => (
          <a key={l.key} className={`nav-item${active === l.key ? " active" : ""}`} href={l.href}
            aria-current={active === l.key ? "page" : undefined}>
            <span className="nav-icon">{l.icon}</span>{l.label}
          </a>
        ))}
      </nav>

      <div className="profile">
        <div className={`avatar avatar-${user?.avatarColor ?? "lime"}`}>
          {user?.avatar ?? "?"}
        </div>
        <div>
          <strong>{user?.name ?? "…"}</strong>
          <small>{user?.title ?? ""}</small>
        </div>
        <button className="logout-btn" onClick={handleLogout} aria-label="Log out" title="Log out">⏻</button>
      </div>
    </aside>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function Metric({ label,value,delta,note,icon,up=false }:{ label:string;value:string;delta:string;note:string;icon:string;up?:boolean }) {
  return (
    <article className="metric">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      <p className="metric-delta"><span className={up?"up":"down"}>{delta}</span><em>{note}</em></p>
    </article>
  );
}
