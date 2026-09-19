"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

    // Basic validation
    if (!fields.email.trim()) { setError("Email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { setError("Enter a valid email address."); return; }
    if (!fields.password) { setError("Password is required."); return; }
    if (fields.password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    setError("");

    // Simulate API call — replace with real auth (e.g. NextAuth, Supabase, etc.)
    await new Promise(r => setTimeout(r, 1000));

    // Demo credentials check
    const validEmail = "lance@gritfit.com";
    const validPassword = "gritfit123";

    if (fields.email === validEmail && fields.password === validPassword) {
      // Store session (replace with real session management)
      sessionStorage.setItem("gritfit_user", JSON.stringify({ name: "Lance Bolo", email: fields.email, role: "Club Manager" }));
      router.push("/");
    } else {
      setLoading(false);
      setError("Incorrect email or password. Try lance@gritfit.com / gritfit123");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-brand" href="/" aria-label="GritFit dashboard">
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
              background: "rgba(227,100,100,.1)",
              border: "1px solid rgba(227,100,100,.35)",
              borderRadius: 4,
              color: "#e36464",
              fontSize: 9,
              padding: "9px 11px",
              marginBottom: 2,
            }}>
              {error}
            </div>
          )}

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="lance@gritfit.com"
            autoComplete="email"
            value={fields.email}
            onChange={handleChange}
            disabled={loading}
            required
          />

          <div className="field-label-row">
            <label htmlFor="password">Password</label>
            <a href="#forgot" onClick={e => e.preventDefault()} style={{ cursor: "default", opacity: 0.5 }}>Forgot password?</a>
          </div>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={fields.password}
              onChange={handleChange}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label className="checkbox-label">
            <input type="checkbox" name="remember" checked={fields.remember} onChange={handleChange} />
            <span>Keep me signed in</span>
          </label>

          <button className="auth-submit" type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "Signing in…" : "Sign in"} {!loading && <span>↗</span>}
          </button>
        </form>

        <p className="auth-switch">
          New to GritFit? <Link href="/signup">Create an account</Link>
        </p>
        <p className="auth-footer">
          By continuing, you agree to our <a href="#terms">terms</a> and <a href="#privacy">privacy policy</a>.
        </p>
      </section>

      <div className="auth-side-note">
        <span>01</span>
        <p>Train with intent.<br /><strong>Move with grit.</strong></p>
      </div>
    </main>
  );
}
