"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/app/lib/supabase/client";

interface Props {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

export default function OtpStep({ email, onVerified, onBack }: Props) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
    const t = setInterval(() => setResendCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  function handleDigit(i: number, val: string) {
    const ch = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    setError("");
    if (ch && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      refs.current[5]?.focus();
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = digits.join("");
    if (token.length < 6) { setError("Enter the 6-digit code."); return; }

    setLoading(true);
    setError("");

    const { error: verifyError } = await createClient().auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    setLoading(false);
    if (verifyError) {
      setError("Invalid or expired code. Try again.");
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
      return;
    }
    onVerified();
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    setError("");
    await createClient().auth.resend({ type: "signup", email });
  }

  return (
    <form className="auth-form" onSubmit={handleVerify} noValidate>
      <div className="auth-intro" style={{ marginTop: 0, marginBottom: 20 }}>
        <p className="eyebrow">Verification</p>
        <h1 style={{ fontSize: 26 }}>Check your email.</h1>
        <p style={{ fontSize: 12, color: "#6b7077", marginTop: 8 }}>
          We sent a 6-digit code to <strong style={{ color: "#c8cdd2" }}>{email}</strong>
        </p>
      </div>

      {error && (
        <div role="alert" className="auth-alert auth-alert-error" style={{ marginBottom: 8 }}>
          <span className="auth-alert-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="otp-inputs" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            className={`otp-digit${error ? " input-error" : ""}`}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      <button className="auth-submit" type="submit" disabled={loading} aria-busy={loading}>
        {loading ? (
          <><span className="auth-spinner" aria-hidden="true" />Verifying…</>
        ) : (
          <>Verify code <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
        )}
      </button>

      <div className="otp-footer">
        <button type="button" className="otp-back" onClick={onBack}>← Back</button>
        <button
          type="button"
          className="otp-resend"
          onClick={handleResend}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
