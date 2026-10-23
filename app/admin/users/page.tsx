"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/page";
import { createClient } from "@/app/lib/supabase/client";
import { getSessionUser, type Profile, type Role } from "@/app/lib/auth";

const ROLE_COLOR: Record<Role, string> = { admin: "#c7fa00", staff: "#ffad3c", client: "#7fa4f0" };
const ROLE_BG:    Record<Role, string> = {
  admin:  "rgba(199,250,0,.1)",
  staff:  "rgba(255,173,60,.1)",
  client: "rgba(127,164,240,.1)",
};

type FilterRole = Role | "all";

export default function AdminUsersPage() {
  const router  = useRouter();
  const [ready,    setReady]    = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [dbError,  setDbError]  = useState("");
  const [filter,   setFilter]   = useState<FilterRole>("all");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [newUser,  setNewUser]  = useState({ name: "", email: "", password: "", role: "client" as Role, title: "" });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = getSessionUser();
    if (!u || u.role !== "admin") { router.push("/login"); return; }
    setReady(true);
  }, [router]);

  // ── Fetch all profiles ──────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setDbError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) { setDbError(error.message); }
    else       { setProfiles(data as Profile[]); }
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) fetchProfiles(); }, [ready, fetchProfiles]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const filtered = profiles.filter(p => {
    const matchRole   = filter === "all" || p.role === filter;
    const matchSearch = !search ||
      p.full_name.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts = {
    all:    profiles.length,
    admin:  profiles.filter(p => p.role === "admin").length,
    staff:  profiles.filter(p => p.role === "staff").length,
    client: profiles.filter(p => p.role === "client").length,
  };

  // ── Role change ─────────────────────────────────────────────────────────────
  async function handleRoleChange(id: string, role: Role) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);
    if (error) { alert("Failed to update role: " + error.message); }
    else { await fetchProfiles(); }
    setSaving(false);
  }

  // ── Delete user ─────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Remove this user? This cannot be undone.")) return;
    setSaving(true);
    const supabase = createClient();
    // Delete the profile — auth.users row is cascade-deleted server-side via service-role
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) { alert("Failed to remove user: " + error.message); }
    else { setSelected(null); await fetchProfiles(); }
    setSaving(false);
  }

  // ── Add user (uses service-role so the admin session is not replaced) ────────
  async function handleAddUser() {
    if (!newUser.name || !newUser.email || !newUser.password) {
      alert("Name, email and password are all required.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const result = await response.json() as { error?: string };

    if (!response.ok) {
      alert("Failed to create user: " + (result.error ?? "Unknown error"));
      setSaving(false);
      return;
    }

    setNewUser({ name: "", email: "", password: "", role: "client", title: "" });
    setShowAdd(false);
    await fetchProfiles();
    setSaving(false);
  }

  if (!ready) return null;

  const selectedProfile = profiles.find(p => p.id === selected) ?? null;

  return (
    <main className="dashboard-shell">
      <Sidebar active="users" />
      <section className="content">
        <header className="topbar">
          <h1>User Management</h1>
          <div className="top-actions">
            <input
              aria-label="Search users" placeholder="Search by name…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ height: 30, background: "#111416", border: "1px solid var(--line)", borderRadius: 6, color: "#ccc", fontSize: 10, padding: "0 12px", outline: "none", width: 200 }}
            />
            <button onClick={() => setShowAdd(v => !v)} style={{
              height: 30, background: "rgba(199,250,0,.1)", border: "1px solid rgba(199,250,0,.25)",
              borderRadius: 6, color: "#c7fa00", fontSize: 9, fontWeight: 700, padding: "0 14px",
              cursor: "pointer", textTransform: "uppercase", letterSpacing: ".04em",
            }}>+ Add User</button>
          </div>
        </header>

        <div className="page-body">
          {/* Error banner */}
          {dbError && (
            <div style={{ background: "rgba(227,100,100,.1)", border: "1px solid rgba(227,100,100,.3)", borderRadius: 6, color: "#e36464", fontSize: 9, padding: "10px 14px" }}>
              Database error: {dbError} — check your Supabase URL/keys and RLS policies.
            </div>
          )}

          {/* KPI tiles */}
          <div className="metrics">
            {(["all", "admin", "staff", "client"] as FilterRole[]).map(r => (
              <article key={r} className="metric" onClick={() => setFilter(r)}
                style={{ cursor: "pointer", border: filter === r ? `1px solid ${r === "all" ? "#505660" : ROLE_COLOR[r as Role]}` : undefined }}>
                <div className="metric-top">
                  <span style={{ textTransform: "capitalize" }}>{r === "all" ? "All Users" : r + "s"}</span>
                  <span className="metric-icon" style={{ color: r === "all" ? "#9da1a5" : ROLE_COLOR[r as Role] }}>
                    {r === "all" ? "⊞" : r === "admin" ? "◉" : r === "staff" ? "♙" : "♟"}
                  </span>
                </div>
                <strong>{loading ? "—" : counts[r]}</strong>
                <p className="metric-delta"><span className="up">{r === "all" ? "Total" : r}</span><em>accounts</em></p>
              </article>
            ))}
          </div>

          {/* Add user form */}
          {showAdd && (
            <div className="panel">
              <div className="panel-heading">
                <h2>Add New User</h2>
                <button className="more" onClick={() => setShowAdd(false)}>✕</button>
              </div>
              <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 120px auto", gap: 10, alignItems: "flex-end" }}>
                {([
                  { label: "Full Name",    key: "name",     placeholder: "John Doe",          type: "text"     },
                  { label: "Email",        key: "email",    placeholder: "john@example.com",  type: "email"    },
                  { label: "Password",     key: "password", placeholder: "Min 8 characters",  type: "password" },
                  { label: "Job Title",    key: "title",    placeholder: "e.g. Head Trainer", type: "text"     },
                ] as { label:string; key: keyof typeof newUser; placeholder:string; type:string }[]).map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 8, color: "#9da1a5", fontWeight: 600, display: "block", marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type} placeholder={f.placeholder}
                      value={newUser[f.key] as string}
                      onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: "100%", height: 36, background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 5, color: "#f2f3f1", fontSize: 10, padding: "0 10px", outline: "none" }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 8, color: "#9da1a5", fontWeight: 600, display: "block", marginBottom: 5 }}>Role</label>
                  <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role }))}
                    style={{ width: "100%", height: 36, background: "#0d0f11", border: "1px solid var(--line)", borderRadius: 5, color: "#f2f3f1", fontSize: 10, padding: "0 10px", outline: "none" }}>
                    <option value="client">Client</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button onClick={handleAddUser} disabled={saving}
                  style={{ height: 36, background: "rgba(199,250,0,.1)", border: "1px solid rgba(199,250,0,.25)", borderRadius: 5, color: "#c7fa00", fontSize: 9, fontWeight: 700, padding: "0 16px", cursor: saving ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: saving ? .6 : 1 }}>
                  {saving ? "…" : "Create"}
                </button>
              </div>
              <div style={{ padding: "0 14px 12px", fontSize: 8, color: "#505660" }}>
                The user will receive a confirmation email from Supabase before they can sign in.
              </div>
            </div>
          )}

          {/* Table + detail */}
          <div className="two-col-6040">
            {/* Users table */}
            <div className="panel">
              <div className="panel-heading">
                <h2>
                  {filter === "all" ? "All Users" : `${filter.charAt(0).toUpperCase() + filter.slice(1)}s`}
                  <span style={{ color: "#505660", fontWeight: 400, marginLeft: 8 }}>
                    ({loading ? "…" : filtered.length})
                  </span>
                </h2>
                <div style={{ display: "flex", gap: 3 }}>
                  {(["all", "admin", "staff", "client"] as FilterRole[]).map(r => (
                    <button key={r} onClick={() => setFilter(r)} style={{
                      fontSize: 8, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
                      border: "1px solid transparent", cursor: "pointer", textTransform: "capitalize",
                      background: filter === r ? (r === "all" ? "rgba(255,255,255,.06)" : ROLE_BG[r as Role]) : "transparent",
                      color: filter === r ? (r === "all" ? "#9da1a5" : ROLE_COLOR[r as Role]) : "#505660",
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div style={{ padding: "32px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>
                  Loading users from Supabase…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "32px 14px", textAlign: "center", color: "#505660", fontSize: 9 }}>
                  No users found.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>User</th><th>Role</th><th>Title</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} onClick={() => setSelected(p.id)}
                        style={{ cursor: "pointer", background: selected === p.id ? "rgba(199,250,0,.04)" : undefined }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className={`avatar avatar-${p.avatar_color}`} style={{ fontSize: 8 }}>
                              {p.avatar_initials}
                            </div>
                            <strong style={{ fontSize: 10 }}>{p.full_name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: ROLE_BG[p.role], color: ROLE_COLOR[p.role] }}>
                            {p.role}
                          </span>
                        </td>
                        <td className="td-muted">{p.title}</td>
                        <td>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={e => { e.stopPropagation(); setSelected(p.id); }}
                              style={{ fontSize: 8, padding: "3px 8px", background: "rgba(127,164,240,.1)", border: "1px solid rgba(127,164,240,.2)", borderRadius: 4, color: "#7fa4f0", cursor: "pointer" }}>
                              Edit
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }} disabled={saving}
                              style={{ fontSize: 8, padding: "3px 8px", background: "rgba(227,100,100,.08)", border: "1px solid rgba(227,100,100,.2)", borderRadius: 4, color: "#e36464", cursor: saving ? "not-allowed" : "pointer" }}>
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {selectedProfile ? (
                <UserDetail
                  profile={selectedProfile}
                  saving={saving}
                  onClose={() => setSelected(null)}
                  onRoleChange={handleRoleChange}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 260, color: "#3a3e44", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>⊞</span>
                  <span style={{ fontSize: 10 }}>Select a user to view details</span>
                </div>
              )}

              {/* Role permissions */}
              <div className="panel">
                <div className="panel-heading"><h2>Role Permissions</h2></div>
                {([
                  { role: "admin"  as Role, pages: ["Dashboard","Revenue","Classes","Trainers","Billing","User Management"], color: "#c7fa00" },
                  { role: "staff"  as Role, pages: ["Staff Dashboard","Classes","Trainer Roster"],                           color: "#ffad3c" },
                  { role: "client" as Role, pages: ["Client Dashboard (own data only)"],                                     color: "#7fa4f0" },
                ]).map(r => (
                  <div key={r.role} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span className="status-pill" style={{ background: ROLE_BG[r.role], color: r.color }}>{r.role}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {r.pages.map(pg => (
                        <span key={pg} style={{ fontSize: 7, background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", borderRadius: 3, padding: "2px 6px", color: "#7a8088" }}>{pg}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ── User detail / edit panel ──────────────────────────────────────────────────

function UserDetail({ profile, saving, onClose, onRoleChange, onDelete }: {
  profile: Profile;
  saving: boolean;
  onClose: () => void;
  onRoleChange: (id: string, role: Role) => void;
  onDelete: (id: string) => void;
}) {
  const [editRole, setEditRole] = useState<Role>(profile.role);

  // Reset when profile changes
  useEffect(() => { setEditRole(profile.role); }, [profile.id, profile.role]);

  return (
    <div className="panel">
      <div className="panel-heading">
        <h2>User Detail</h2>
        <button className="more" onClick={onClose}>✕</button>
      </div>

      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 14px", borderBottom: "1px solid var(--line)" }}>
        <div className={`avatar avatar-${profile.avatar_color}`} style={{ width: 46, height: 46, fontSize: 13, flex: "0 0 46px" }}>
          {profile.avatar_initials}
        </div>
        <div>
          <strong style={{ fontSize: 13, display: "block", letterSpacing: "-.02em" }}>{profile.full_name}</strong>
          <small style={{ color: "#505660", fontSize: 9 }}>{profile.title}</small>
        </div>
      </div>

      <div className="stat-row">
        <span className="label">User ID</span>
        <span style={{ fontSize: 8, color: "#505660", fontFamily: "monospace" }}>{profile.id.slice(0, 18)}…</span>
      </div>
      <div className="stat-row">
        <span className="label">Current Role</span>
        <span className="status-pill" style={{ background: ROLE_BG[profile.role], color: ROLE_COLOR[profile.role] }}>{profile.role}</span>
      </div>
      <div className="stat-row">
        <span className="label">Member Since</span>
        <span className="val">{new Date(profile.created_at).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" })}</span>
      </div>

      {/* Role editor */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)" }}>
        <label style={{ fontSize: 8, color: "#9da1a5", fontWeight: 600, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".04em" }}>
          Change Role
        </label>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["client", "staff", "admin"] as Role[]).map(r => (
            <button key={r} onClick={() => setEditRole(r)} style={{
              flex: 1, padding: "7px 4px", borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              background: editRole === r ? ROLE_BG[r] : "transparent",
              border: `1px solid ${editRole === r ? ROLE_COLOR[r] + "50" : "var(--line)"}`,
              color: editRole === r ? ROLE_COLOR[r] : "#505660",
            }}>{r}</button>
          ))}
        </div>
        <button
          onClick={() => onRoleChange(profile.id, editRole)}
          disabled={editRole === profile.role || saving}
          style={{
            width: "100%", height: 34, borderRadius: 5, fontSize: 9, fontWeight: 700,
            cursor: editRole === profile.role || saving ? "not-allowed" : "pointer",
            background: editRole === profile.role ? "transparent" : "rgba(199,250,0,.1)",
            border: `1px solid ${editRole === profile.role ? "var(--line)" : "rgba(199,250,0,.25)"}`,
            color: editRole === profile.role ? "#3a3e44" : "#c7fa00",
            textTransform: "uppercase", letterSpacing: ".04em",
            opacity: saving ? .6 : 1,
          }}>
          {saving ? "Saving…" : editRole === profile.role ? "No changes" : `Save — Set as ${editRole}`}
        </button>
      </div>

      {/* Danger zone */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)" }}>
        <div style={{ fontSize: 8, color: "#e36464", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>
          Danger Zone
        </div>
        <button onClick={() => onDelete(profile.id)} disabled={saving}
          style={{ width: "100%", height: 30, borderRadius: 5, fontSize: 8, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", background: "rgba(227,100,100,.06)", border: "1px solid rgba(227,100,100,.2)", color: "#e36464", opacity: saving ? .6 : 1 }}>
          Remove User Permanently
        </button>
      </div>
    </div>
  );
}
