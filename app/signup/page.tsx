"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Fields {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  terms: boolean;
}

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fields, setFields] = useState<Fields>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    terms: false,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setFields(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
  }

  function validate(): string {
    if (!fields.firstName.trim()) return "First name is required.";
    if (!fields.lastName.trim()) return "Last name is required.";
    if (!fields.email.trim()) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return "Enter a valid email address.";
    if (!fields.password) return "Password is required.";
    if (fields.password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(fields.password)) return "Password must include at least one uppercase letter.";
    if (!/[0-9]/.test(fields.password)) return "Password must include at least one number.";
    if (!fields.terms) return "You must agree to the member terms to continue.";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError("");

    // Simulate API call — replace with real registration endpoint
    await new Promise(r => setTimeout(r, 1200));

    // Set auth cookie so the proxy can protect routes server-side
    document.cookie = "gritfit_session=1; path=/; SameSite=Lax";
    // Store new user session
    sessionStorage.setItem("gritfit_user", JSON.stringify({
      name: `${fields.firstName} ${fields.lastName}`,
      email: fields.email,
      role: "Member",
    }));

    setSuccess(true);
    setLoading(false);

    // Redirect to dashboard after brief success flash
    setTimeout(() => router.push("/"), 1000);
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card auth-card-signup" aria-labelledby="signup-title">
        <Link className="auth-brand" href="/" aria-label="GritFit dashboard">
          <span className="brand-mark">✦</span>
          <span>GRITFIT<small>FITNESS CENTER</small></span>
        </Link>

        <div className="auth-intro">
          <p className="eyebrow">Start your next chapter</p>
          <h1 id="signup-title">Build your base.</h1>
          <p>Create your GritFit account and make every session count.</p>
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

          {success && (
            <div role="status" style={{
              background: "rgba(199,250,0,.08)",
              border: "1px solid rgba(199,250,0,.35)",
              borderRadius: 4,
              color: "#c7fa00",
              fontSize: 9,
              padding: "9px 11px",
              marginBottom: 2,
            }}>
              Account created! Redirecting to dashboard…
            </div>
          )}

          <div className="form-row">
            <div>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="Lance"
                autoComplete="given-name"
                value={fields.firstName}
                onChange={handleChange}
                disabled={loading || success}
                required
              />
            </div>
            <div>
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Bolo"
                autoComplete="family-name"
                value={fields.lastName}
                onChange={handleChange}
                disabled={loading || success}
                required
              />
            </div>
          </div>

          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@gritfit.com"
            autoComplete="email"
            value={fields.email}
            onChange={handleChange}
            disabled={loading || success}
            required
          />

          <label htmlFor="signup-password">Create password</label>
          <div className="password-field">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
              value={fields.password}
              onChange={handleChange}
              disabled={loading || success}
              minLength={8}
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

          {/* Password strength indicator */}
          {fields.password.length > 0 && (
            <PasswordStrength password={fields.password} />
          )}

          <label className="checkbox-label">
            <input type="checkbox" name="terms" checked={fields.terms} onChange={handleChange} />
            <span>I agree to the <a href="#terms">member terms</a> and privacy policy</span>
          </label>

          <button className="auth-submit" type="submit" disabled={loading || success} style={{ opacity: loading || success ? 0.7 : 1 }}>
            {loading ? "Creating account…" : success ? "Done!" : "Create account"} {!loading && !success && <span>↗</span>}
          </button>
        </form>

        <p className="auth-switch">
          Already a member? <Link href="/login">Sign in instead</Link>
        </p>
      </section>

      <div className="auth-side-note">
        <span>01</span>
        <p>Train with intent.<br /><strong>Move with grit.</strong></p>
      </div>
    </main>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#e36464", "#e36464", "#ffad3c", "#c7fa00", "#c7fa00"];

  return (
    <div style={{ marginBottom: 8, marginTop: -4 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < score ? colors[score] : "#26292b",
            transition: "background .2s",
          }} />
        ))}
      </div>
      <small style={{ fontSize: 7, color: score > 0 ? colors[score] : "#9da1a5" }}>
        {labels[score]}
      </small>
    </div>
  );
}
