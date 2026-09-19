"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  return (
    <main className="dashboard-shell">
      <Sidebar active="dashboard" />

      <section className="content" id="overview">
        <header className="topbar"><h1>Executive Dashboard</h1><div className="top-actions"><label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search members, classes..." /></label><button className="status">● System Active</button><button className="icon-button" aria-label="Notifications">♧</button></div></header>

        <div className="page-body">
          <div className="metrics">
            <Metric label="Active Members" value="2,481" delta="+12.4%" note="vs last month" icon="♟" />
            <Metric label="Monthly Revenue" value="$48,290" delta="+8.2%" note="vs last month" icon="▱" />
            <Metric label="Check-ins Today" value="382" delta="+15.6%" note="vs last month" icon="⌁" />
            <Metric label="Class Attendance" value="92.4%" delta="-1.2%" note="vs last month" icon="▣" negative />
          </div>

          <div className="main-grid">
            <div className="left-column">
              <section className="panel chart-panel">
                <div className="panel-heading"><h2>Membership Growth &amp; Acquisition</h2><div className="chart-controls"><button className="selected">YoY</button><button>Month</button></div></div>
                <div className="chart"><div className="chart-grid"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span></div><svg viewBox="0 0 720 130" role="img" aria-label="Membership growth trend"><path d="M0 93 L65 84 L130 89 L195 83 L260 71 L325 57 L390 63 L455 50 L520 39 L585 29 L650 20 L720 10" fill="none" stroke="#c7fa00" strokeWidth="2" /></svg></div>
              </section>
              <div className="lower-grid">
                <section className="panel checkins"><div className="panel-heading"><h2>Recent Member Check-ins</h2><button className="more" aria-label="More check-ins">•••</button></div><Member name="John Doe" type="VIP" time="08:54 AM" initials="JD" color="orange" /><Member name="Sarah Connor" type="Premium" time="08:11 AM" initials="SC" color="blue" /><Member name="James Smith" type="Basic" time="08:06 AM" initials="JS" color="red" /></section>
                <section className="panel utilization"><div className="panel-heading"><h2>Trainer Utilization</h2><button className="more" aria-label="More trainer details">•••</button></div><div className="donut-wrap"><div className="donut"><strong>75%</strong><span>Utilized</span></div><div className="legend"><span><i className="lime" />Personal Training <b>(45 hrs)</b></span><span><i className="blue" />Group Lead <b>(15 hrs)</b></span></div></div></section>
              </div>
            </div>
            <section className="panel schedule"><div className="panel-heading"><h2>Today&apos;s Class Schedule</h2><button className="more" aria-label="More classes">•••</button></div><ClassItem title="HIIT Performance" time="09:00 - 10:00 AM" meta="Coach Marcus · Studio A" tag="10/12" color="red" /><ClassItem title="Power Boxing" time="11:30 - 12:30 PM" meta="Coach Victor · Combat Ring" tag="9/15" color="orange" /><ClassItem title="Ash­tanga Yoga" time="05:00 - 06:00 PM" meta="Elena Petrova · Mind & Body" tag="15/25" color="teal" /><ClassItem title="CrossFit WOD" time="07:00 - 08:00 PM" meta="Coach Marcus · Studio B" tag="22/22" color="lime" /></section>
          </div>
        </div>
      </section>
    </main>
  );
}

// ─── Shared sidebar ────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/",         label: "Dashboard",         icon: "◉", key: "dashboard" },
  { href: "/revenue",  label: "Revenue",            icon: "◒", key: "revenue"   },
  { href: "/classes",  label: "Classes & Timetable",icon: "▣", key: "classes"   },
  { href: "/trainers", label: "Trainer Roster",     icon: "♙", key: "trainers"  },
  { href: "/billing",  label: "Billing & Payments", icon: "▤", key: "billing"   },
];

export function Sidebar({ active }: { active: string }) {
  const router = useRouter();

  function handleLogout() {
    sessionStorage.removeItem("gritfit_user");
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span>GRITFIT<small>FITNESS CENTER</small></span>
      </div>

      <nav className="nav-list" aria-label="Main navigation">
        {NAV_LINKS.map(l => (
          <a key={l.key} className={`nav-item${active === l.key ? " active" : ""}`} href={l.href}>
            <span>{l.icon}</span>{l.label}
          </a>
        ))}
      </nav>

      <div className="profile">
        <div className="avatar avatar-lime">LB</div>
        <div><strong>Lance Bolo</strong><small>Club Manager</small></div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid #2d3033",
            borderRadius: 4,
            color: "#7f8388",
            cursor: "pointer",
            fontSize: 9,
            padding: "4px 7px",
            lineHeight: 1,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#e36464";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e36464";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#7f8388";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#2d3033";
          }}
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}

// ─── Small components ──────────────────────────────────────────────────────────

function Metric({ label, value, delta, note, icon, negative = false }: { label: string; value: string; delta: string; note: string; icon: string; negative?: boolean }) {
  return <article className="metric"><div className="metric-top"><span>{label}</span><b>{icon}</b></div><strong>{value}</strong><p className={negative ? "negative" : ""}>{delta} <em>{note}</em></p></article>;
}

function Member({ name, type, time, initials, color }: { name: string; type: string; time: string; initials: string; color: string }) {
  return <div className="member"><div className={`avatar avatar-${color}`}>{initials}</div><div><strong>{name}</strong><small>{type}</small></div><time>{time}</time></div>;
}

function ClassItem({ title, time, meta, tag, color }: { title: string; time: string; meta: string; tag: string; color: string }) {
  return <div className="class-item"><div className={`class-line ${color}`} /><div><strong>{title}</strong><small>{time}</small><small>{meta}</small></div><span>{tag}</span></div>;
}
