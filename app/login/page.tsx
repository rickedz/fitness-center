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
import OtpStep from "@/app/components/OtpStep";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({ email: "", password: "", remember: false });
  const [otpPending, setOtpPending] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [pendingAuthUser, setPendingAuthUser] = useState<{ id: string; email?: string } | null>(null);

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

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: fields.email,
      password: fields.password,
    });

    if (authError || !authData.user) {
      setLoading(false);
      setError(authError?.message ?? "Incorrect email or password.");
      return;
    }

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

    // Admin skips OTP
    if (typedProfile.role === "admin") {
      const maxAge = fields.remember ? "; max-age=604800" : "";
      document.cookie = `${ROLE_COOKIE}=${typedProfile.role}; path=/; SameSite=Lax${maxAge}`;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionUser(authData.user, typedProfile)));
      router.push(homeForRole(typedProfile.role as Role));
      return;
    }

    // Staff and client: send OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: fields.email,
      options: { shouldCreateUser: false },
    });

    setLoading(false);

    if (otpError) {
      setError("Failed to send verification code. Please try again.");
      return;
    }

    setPendingProfile(typedProfile);
    setPendingAuthUser(authData.user);
    setOtpPending(true);
  }

  function handleOtpVerified() {
    if (!pendingProfile || !pendingAuthUser) return;
    const maxAge = fields.remember ? "; max-age=604800" : "";
    document.cookie = `${ROLE_COOKIE}=${pendingProfile.role}; path=/; SameSite=Lax${maxAge}`;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionUser(pendingAuthUser, pendingProfile)));
    router.push(homeForRole(pendingProfile.role as Role));
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <aside className="auth-panel" aria-hidden="true">
        <div className="auth-panel-inner">
          <div className="auth-panel-logo">
            <span className="brand-mark">✦</span>
          </div>
          <blockquote className="auth-panel-quote">
            <p>&quot;Every rep is a vote<br />for the person<br />you&apos;re becoming.&quot;</p>
          </blockquote>
          <div className="auth-panel-stats">
            <div className="auth-panel-stat">
              <strong>2,400+</strong>
              <span>Active members</span>
            </div>
            <div className="auth-panel-stat">
              <strong>48</strong>
              <span>Weekly classes</span>
            </div>
            <div className="auth-panel-stat">
              <strong>12</strong>
              <span>Expert trainers</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="auth-card auth-card-animate" aria-labelledby="login-title">
        <Link className="auth-brand" href="/login" aria-label="GritFit">
          <span className="brand-mark">✦</span>
          <span>GRITFIT<small>FITNESS CENTER</small></span>
        </Link>

        {otpPending ? (
          <OtpStep
            email={fields.email}
            onVerified={handleOtpVerified}
            onBack={() => { setOtpPending(false); setError(""); }}
          />
        ) : (
          <>
            <div className="auth-intro">
              <p className="eyebrow">Member portal</p>
              <h1 id="login-title">Welcome back.</h1>
              <p>Sign in to keep your training moving forward.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <div role="alert" className="auth-alert auth-alert-error">
                  <span className="auth-alert-icon">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email" name="email" type="email" placeholder="you@gritfit.com"
                  autoComplete="email" value={fields.email} onChange={handleChange}
                  disabled={loading} required
                />
              </div>

              <div className="auth-field">
                <div className="field-label-row">
                  <label htmlFor="password">Password</label>
                  <Link href="#" className="forgot-link" tabIndex={0}
                    onClick={e => e.preventDefault()}>
                    Forgot password?
                  </Link>
                </div>
                <div className="password-field">
                  <input
                    id="password" name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={fields.password} onChange={handleChange}
                    disabled={loading} required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="checkbox-label">
                <input type="checkbox" name="remember" checked={fields.remember} onChange={handleChange} />
                <span>Keep me signed in for 7 days</span>
              </label>

              <button className="auth-submit" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </>
                )}
              </button>
            </form>

            <p className="auth-switch">
              New to GritFit? <Link href="/signup">Create an account</Link>
            </p>
            <p className="auth-footer">
              By continuing you agree to our <a href="#">terms</a> and <a href="#">privacy policy</a>.
            </p>
          </>
        )}
      </section>

      <div className="auth-side-note">
        <span>01</span>
        <p>Train with intent.<br /><strong>Move with grit.</strong></p>
      </div>
    </main>
  );
}
