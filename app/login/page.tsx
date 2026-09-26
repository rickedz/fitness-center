"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import {
  ROLE_COOKIE,
  SESSION_KEY,
  homeForRole,
  buildSessionUser,
  type Role,
  type Profile,
} from "@/app/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({ email: "", password: "", remember: false });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setFields(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fields.email.trim()) { setError("Email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { setError("Enter a valid email address."); return; }
    if (!fields.password) { setError("Password is required."); return; }
    if (fields.password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    setError("");

    const supabase = createClient();

    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: fields.email,
      password: fields.password,
    });

    if (authError || !authData.user) {
      setLoading(false);
      setError(authError?.message ?? "Incorrect email or password.");
      return;
    }

    // 2. Fetch the user's profile (role, name, avatar, etc.)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      setLoading(false);
      setError("Account found but profile is missing. Contact support.");
      return;
    }

    const typedProfile = profile as Profile;

    // 3. Set role cookie so middleware can do role-based routing without a DB hit
    const maxAge = fields.remember ? "; max-age=604800" : "";
    document.cookie = `${ROLE_COOKIE}=${typedProfile.role}; path=/; SameSite=Lax${maxAge}`;

    // 4. Store display info in sessionStorage
    const sessionUser = buildSessionUser(authData.user, typedProfile);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

    // 5. Redirect to the correct home for this role
    router.push(homeForRole(typedProfile.role as Role));
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-brand" href="/login" aria-label="GritFit">
          <span className="brand-mark">✦</span>
          <span>GRITFIT<small>FITNESS CENTER</small></span>
        </Link>

        <div className="auth-intro">
          <p className="eyebrow">Member portal</p>
          <h1 id="login-title">Welcome back.</h1>
          <p>Sign in to keep your training moving forward.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div role="alert" style={{
              background: "rgba(227,100,100,.1)", border: "1px solid rgba(227,100,100,.35)",
              borderRadius: 4, color: "#e36464", fontSize: 9, padding: "9px 11px", marginBottom: 2,
            }}>
              {error}
            </div>
          )}

          <label htmlFor="email">Email address</label>
          <input
            id="email" name="email" type="email" placeholder="you@gritfit.com"
            autoComplete="email" value={fields.email} onChange={handleChange}
            disabled={loading} required
          />

          <div className="field-label-row">
            <label htmlFor="password">Password</label>
          </div>
          <div className="password-field">
            <input
              id="password" name="password" type={showPassword ? "text" : "password"}
              placeholder="Enter your password" autoComplete="current-password"
              value={fields.password} onChange={handleChange} disabled={loading} required
            />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label className="checkbox-label">
            <input type="checkbox" name="remember" checked={fields.remember} onChange={handleChange} />
            <span>Keep me signed in</span>
          </label>

          <button className="auth-submit" type="submit" disabled={loading}
            style={{ opacity: loading ? .7 : 1 }}>
            {loading ? "Signing in…" : "Sign in"}{!loading && <span>↗</span>}
          </button>
        </form>

        {/* Role hint box */}
        <div style={{
          marginTop: 18, padding: "12px 14px",
          background: "rgba(199,250,0,.04)", border: "1px solid rgba(199,250,0,.1)", borderRadius: 6,
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "#c7fa00", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
            Account roles
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            {([
              { role: "Admin",  color: "#c7fa00", desc: "Full access — revenue, billing, user management" },
              { role: "Staff",  color: "#ffad3c", desc: "Classes, trainer roster, check-ins"              },
              { role: "Client", color: "#7fa4f0", desc: "Personal schedule, membership & billing"         },
            ]).map(d => (
              <div key={d.role} style={{ display: "flex", gap: 8, fontSize: 8 }}>
                <span style={{ color: d.color, fontWeight: 700, width: 44, flexShrink: 0 }}>{d.role}</span>
                <span style={{ color: "#505660" }}>{d.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="auth-switch">New to GritFit? <Link href="/signup">Create an account</Link></p>
        <p className="auth-footer">
          By continuing you agree to our <a href="#">terms</a> and <a href="#">privacy policy</a>.
        </p>
      </section>

      <div className="auth-side-note">
        <span>01</span>
        <p>Train with intent.<br /><strong>Move with grit.</strong></p>
      </div>
    </main>
  );
}
