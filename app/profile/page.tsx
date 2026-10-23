"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, Topbar } from "@/app/page";
import { getSessionUser, setSessionUser, homeForRole, type SessionUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/client";

const COLORS = ["lime", "orange", "blue", "red", "teal", "purple"] as const;
type AvatarColor = typeof COLORS[number];

const COLOR_HEX: Record<AvatarColor, string> = {
  lime: "#c7fa00", orange: "#ffad3c", blue: "#7fa4f0",
  red: "#ee4b65", teal: "#00c9a7", purple: "#b99af5",
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser]       = useState<SessionUser | null>(null);
  const [name, setName]       = useState("");
  const [title, setTitle]     = useState("");
  const [color, setColor]     = useState<AvatarColor>("lime");
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    const u = getSessionUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    setName(u.name);
    setTitle(u.title);
    setColor((u.avatarColor as AvatarColor) ?? "lime");
  }, [router]);

  if (!user) return null;

  const initials = name.trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase() || "?";

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    setSuccess(false);

    const { error: dbErr } = await createClient()
      .from("profiles")
      .update({ full_name: name.trim(), avatar_initials: initials, avatar_color: color })
      .eq("id", user.id);

    if (dbErr) {
      setError(dbErr.message);
    } else {
      const updated: SessionUser = { ...user, name: name.trim(), avatar: initials, avatarColor: color };
      setSessionUser(updated);
      setUser(updated);
      setSuccess(true);
    }
    setSaving(false);
  }

  return (
    <main className="dashboard-shell">
      <Sidebar active="profile" />
      <section className="content">
        <Topbar title="My Profile" />

        <div className="page-body" style={{ maxWidth: 640 }}>

          {/* Avatar preview banner */}
          <div className="panel" style={{ background: "linear-gradient(135deg,#0d1100 0%,#111315 70%)", border: "1px solid rgba(199,250,0,.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "22px 24px" }}>
              <div className={`avatar avatar-${color}`} style={{ width: 64, height: 64, fontSize: 18, flex: "0 0 64px", border: "2px solid rgba(255,255,255,.1)" }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1, marginBottom: 5 }}>
                  {name || "—"}
                </div>
                <div style={{ fontSize: 10, color: "#6b7077", marginBottom: 8 }}>{title || "No title set"}</div>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                  padding: "3px 9px", borderRadius: 10,
                  background: "rgba(199,250,0,.1)", color: "#c7fa00", border: "1px solid rgba(199,250,0,.2)",
                }}>{user.role}</span>
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="panel">
            <div className="panel-heading"><h2>Account Details</h2></div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#9da1a5", fontWeight: 600 }}>
                Full Name
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setSuccess(false); }}
                  autoComplete="name"
                  style={{ height: 38, padding: "0 12px", background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 6, color: "#f2f3f1", fontSize: 12 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#9da1a5", fontWeight: 600 }}>
                Email (cannot be changed)
                <input
                  value={user.email}
                  readOnly
                  style={{ height: 38, padding: "0 12px", background: "#111315", border: "1px solid var(--line)", borderRadius: 6, color: "#505660", fontSize: 12, cursor: "not-allowed" }}
                />
              </label>



              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9da1a5", fontWeight: 600 }}>Avatar Color</span>
                <div style={{ display: "flex", gap: 10 }}>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setColor(c); setSuccess(false); }}
                      title={c}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: COLOR_HEX[c],
                        outline: color === c ? `3px solid ${COLOR_HEX[c]}` : "3px solid transparent",
                        outlineOffset: 2,
                        opacity: color === c ? 1 : 0.4,
                        transition: "opacity .15s, outline .15s",
                      }}
                    />
                  ))}
                </div>
              </div>

              {error   && <p role="alert"  style={{ margin: 0, fontSize: 11, color: "#e36464" }}>{error}</p>}
              {success && <p role="status" style={{ margin: 0, fontSize: 11, color: "#00c9a7" }}>✓ Profile saved successfully.</p>}

              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1, height: 40, fontWeight: 700, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase",
                    background: "rgba(199,250,0,.1)", border: "1px solid rgba(199,250,0,.25)", borderRadius: 6,
                    color: "#c7fa00", cursor: "pointer", opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(homeForRole(user.role))}
                  style={{
                    height: 40, padding: "0 18px", fontWeight: 600, fontSize: 11,
                    background: "transparent", border: "1px solid var(--line)", borderRadius: 6,
                    color: "#505660", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Read-only info */}
          <div className="panel">
            <div className="panel-heading"><h2>Account Info</h2></div>
            <div className="stat-row"><span className="label">Role</span><span className="val" style={{ textTransform: "capitalize" }}>{user.role}</span></div>
            <div className="stat-row"><span className="label">User ID</span><span className="val" style={{ fontSize: 9, color: "#505660", fontFamily: "monospace" }}>{user.id}</span></div>
          </div>

        </div>
      </section>
    </main>
  );
}
