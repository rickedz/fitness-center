"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { ROLE_COOKIE, SESSION_KEY, buildSessionUser, type Profile } from "@/app/lib/auth";
import OtpStep from "@/app/components/OtpStep";

interface Fields {
  firstName:       string;
  lastName:        string;
  email:           string;
  password:        string;
  confirmPassword: string;
  terms:           boolean;
}

type FieldErrors = Partial<Record<keyof Fields, string>>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [globalError, setGlobalError]           = useState("");
  const [existingAccount, setExistingAccount]   = useState(false);
  const [fieldErrors, setFieldErrors]           = useState<FieldErrors>({});
  const [success, setSuccess]                   = useState(false);
  const [successMessage, setSuccessMessage]     = useState("");
  const [otpPending, setOtpPending]             = useState(false);
  const [pendingUser, setPendingUser]           = useState<{ id: string; email?: string } | null>(null);
  const [pendingProfile, setPendingProfile]     = useState<Profile | null>(null);
  const [fields, setFields]                     = useState<Fields>({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "", terms: false,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setFields(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (fieldErrors[name as keyof Fields]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (globalError) setGlobalError("");
    if (existingAccount) setExistingAccount(false);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const err = validateField(name as keyof Fields, value);
    if (err) setFieldErrors(prev => ({ ...prev, [name]: err }));
  }

  function validateField(name: keyof Fields, value: string): string {
    switch (name) {
      case "firstName":
        return value.trim() ? "" : "First name is required.";
      case "lastName":
        return value.trim() ? "" : "Last name is required.";
      case "email":
        if (!value.trim()) return "Email address is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
        return "";
      case "password":
        if (!value) return "Password is required.";
        if (value.length < 8) return "Must be at least 8 characters.";
        if (!/[A-Z]/.test(value)) return "Include at least one uppercase letter.";
        if (!/[0-9]/.test(value)) return "Include at least one number.";
        return "";
      case "confirmPassword":
        if (!value) return "Please confirm your password.";
        if (value !== fields.password) return "Passwords do not match.";
        return "";
      default:
        return "";
    }
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    (Object.keys(fields) as (keyof Fields)[]).forEach(key => {
      if (key === "terms") return;
      const err = validateField(key, fields[key] as string);
      if (err) errors[key] = err;
    });
    if (!fields.terms) errors.terms = "You must agree to the member terms.";
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    setLoading(true);
    setGlobalError("");

    const supabase  = createClient();
    const fullName  = `${fields.firstName} ${fields.lastName}`.trim();
    const initials  = (fields.firstName[0] + fields.lastName[0]).toUpperCase();
    const colors    = ["orange", "blue", "teal", "red", "purple", "lime"] as const;
    const color     = colors[Math.floor(Math.random() * colors.length)];

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email:    fields.email,
      password: fields.password,
      options: {
        data: {
          full_name:       fullName,
          avatar_initials: initials,
          avatar_color:    color,
          title:           "Basic Member",
        },
      },
    });

    if (signUpError || !authData.user) {
      setLoading(false);
      if (signUpError?.message.toLowerCase().includes("already registered")) {
        setExistingAccount(true);
        setGlobalError("An account already exists for this email address.");
      } else {
        setGlobalError(signUpError?.message ?? "Sign-up failed. Please try again.");
      }
      return;
    }

    // Send OTP for verification
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: fields.email,
      options: { shouldCreateUser: false },
    });

    setLoading(false);

    if (otpError) {
      setGlobalError("Account created but failed to send verification code. Please sign in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      setGlobalError("Account created, but profile could not be loaded. Please sign in.");
      return;
    }

    setPendingUser(authData.user);
    setPendingProfile(profile as Profile);
    setOtpPending(true);
  }

  function handleOtpVerified() {
    if (!pendingUser || !pendingProfile) return;
    document.cookie = `${ROLE_COOKIE}=client; path=/; SameSite=Lax`;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionUser(pendingUser, pendingProfile)));
    setSuccess(true);
    setSuccessMessage("Account verified! Redirecting…");
    setTimeout(() => router.push("/client"), 1000);
  }

  async function handleResendConfirmation() {
    if (!fields.email.trim()) return;

    setResendingConfirmation(true);
    setGlobalError("");

    const { error } = await createClient().auth.resend({
      type: "signup",
      email: fields.email.trim(),
    });

    setResendingConfirmation(false);

    if (error) {
      setGlobalError(error.message);
      return;
    }

    setExistingAccount(false);
    setSuccess(true);
    setSuccessMessage("Confirmation email sent. Open it to verify your address, then sign in.");
  }

  if (otpPending) {
    return (
      <main className="auth-page">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <section className="auth-card auth-card-animate">
          <Link className="auth-brand" href="/login" aria-label="GritFit">
            <span className="brand-mark">✦</span>
            <span>GRITFIT<small>FITNESS CENTER</small></span>
          </Link>
          {success ? (
            <div role="status" className="auth-alert auth-alert-success" style={{ marginTop: 32 }}>
              <span className="auth-alert-icon">✓</span>
              <span>{successMessage}</span>
            </div>
          ) : (
            <OtpStep
              email={fields.email}
              onVerified={handleOtpVerified}
              onBack={() => setOtpPending(false)}
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      {/* Decorative side panel */}
      <aside className="auth-panel" aria-hidden="true">
        <div className="auth-panel-inner">
          <div className="auth-panel-logo">
            <span className="brand-mark">✦</span>
          </div>
          <blockquote className="auth-panel-quote">
            <p>&quot;The body achieves<br />what the mind<br />believes.&quot;</p>
          </blockquote>
          <div className="auth-panel-steps">
            <p className="auth-panel-steps-label">Getting started</p>
            {[
              { n: "01", label: "Create your account" },
              { n: "02", label: "Choose a membership plan" },
              { n: "03", label: "Book your first class" },
            ].map(s => (
              <div key={s.n} className="auth-panel-step">
                <span>{s.n}</span>
                <p>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="auth-card auth-card-signup auth-card-animate" aria-labelledby="signup-title">
        <Link className="auth-brand" href="/login" aria-label="GritFit">
          <span className="brand-mark">✦</span>
          <span>GRITFIT<small>FITNESS CENTER</small></span>
        </Link>

        <div className="auth-intro">
          <p className="eyebrow">Start your next chapter</p>
          <h1 id="signup-title">Build your base.</h1>
          <p>Create your GritFit account and make every session count.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {globalError && (
            <div role="alert" className="auth-alert auth-alert-error">
              <span className="auth-alert-icon">⚠</span>
              <span>{globalError}</span>
            </div>
          )}
          {existingAccount && (
            <div className="auth-existing-account">
              <Link href="/login">Sign in instead</Link>
              <button type="button" onClick={handleResendConfirmation} disabled={resendingConfirmation}>
                {resendingConfirmation ? "Sending confirmation email…" : "Resend confirmation email"}
              </button>
            </div>
          )}
          {success && (
            <div role="status" className="auth-alert auth-alert-success">
              <span className="auth-alert-icon">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          <div className="form-row">
            <div className="auth-field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName" name="firstName" type="text" placeholder="John"
                autoComplete="given-name" value={fields.firstName}
                onChange={handleChange} onBlur={handleBlur}
                disabled={loading || success} required
                aria-invalid={!!fieldErrors.firstName}
                aria-describedby={fieldErrors.firstName ? "firstName-err" : undefined}
                className={fieldErrors.firstName ? "input-error" : ""}
              />
              {fieldErrors.firstName && (
                <span className="field-error" id="firstName-err" role="alert">{fieldErrors.firstName}</span>
              )}
            </div>
            <div className="auth-field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName" name="lastName" type="text" placeholder="Doe"
                autoComplete="family-name" value={fields.lastName}
                onChange={handleChange} onBlur={handleBlur}
                disabled={loading || success} required
                aria-invalid={!!fieldErrors.lastName}
                aria-describedby={fieldErrors.lastName ? "lastName-err" : undefined}
                className={fieldErrors.lastName ? "input-error" : ""}
              />
              {fieldErrors.lastName && (
                <span className="field-error" id="lastName-err" role="alert">{fieldErrors.lastName}</span>
              )}
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email" name="email" type="email" placeholder="you@example.com"
              autoComplete="email" value={fields.email}
              onChange={handleChange} onBlur={handleBlur}
              disabled={loading || success} required
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-err" : undefined}
              className={fieldErrors.email ? "input-error" : ""}
            />
            {fieldErrors.email && (
              <span className="field-error" id="email-err" role="alert">{fieldErrors.email}</span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="signup-password">Create password</label>
            <div className="password-field">
              <input
                id="signup-password" name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                autoComplete="new-password" value={fields.password}
                onChange={handleChange} onBlur={handleBlur}
                disabled={loading || success} minLength={8} required
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "password-err" : undefined}
                className={fieldErrors.password ? "input-error" : ""}
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
            {fieldErrors.password && (
              <span className="field-error" id="password-err" role="alert">{fieldErrors.password}</span>
            )}
            {fields.password.length > 0 && !fieldErrors.password && (
              <PasswordStrength password={fields.password} />
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="password-field">
              <input
                id="confirmPassword" name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                autoComplete="new-password" value={fields.confirmPassword}
                onChange={handleChange} onBlur={handleBlur}
                disabled={loading || success} required
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? "confirm-err" : undefined}
                className={fieldErrors.confirmPassword ? "input-error" : ""}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <span className="field-error" id="confirm-err" role="alert">{fieldErrors.confirmPassword}</span>
            )}
            {fields.confirmPassword && !fieldErrors.confirmPassword && fields.password === fields.confirmPassword && (
              <span className="field-hint-ok">✓ Passwords match</span>
            )}
          </div>

          <label className="checkbox-label" style={{ marginTop: 2 }}>
            <input
              type="checkbox" name="terms"
              checked={fields.terms} onChange={handleChange}
              aria-invalid={!!fieldErrors.terms}
            />
            <span>
              I agree to the <a href="#">member terms</a> and <a href="#">privacy policy</a>
            </span>
          </label>
          {fieldErrors.terms && (
            <span className="field-error" role="alert" style={{ marginTop: -4 }}>{fieldErrors.terms}</span>
          )}

          <button
            className="auth-submit" type="submit"
            disabled={loading || success}
            aria-busy={loading}
            style={{ marginTop: 6 }}
          >
            {loading ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                Creating account…
              </>
            ) : success ? (
              <>
                <span>✓</span>
                Done!
              </>
            ) : (
              <>
                Create account
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </>
            )}
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
  const score  = checks.filter(Boolean).length;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#e36464", "#e36464", "#ffad3c", "#c7fa00", "#c7fa00"];
  return (
    <div className="password-strength">
      <div className="password-strength-bars">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="password-strength-bar"
            style={{ background: i < score ? colors[score] : "#1e2124" }}
          />
        ))}
      </div>
      <small style={{ color: score > 0 ? colors[score] : "#6b7077" }}>
        {labels[score]}
      </small>
    </div>
  );
}
