"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, storage } from "@/lib/api";

type Step = "phone" | "otp" | "name";

function getRoleHome(role?: string) {
  if (role === "admin") return "/super-admin";
  if (role === "restaurant_owner") return "/restaurant";
  return "/menu";
}

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [fullName, setFullName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If already logged in, return to the workspace for this account role.
  useEffect(() => {
    const auth = storage.getAuth();
    if (auth) router.replace(getRoleHome(auth.user.role));
  }, [router]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startCountdown = (secs = 60) => {
    setResendCountdown(secs);
    countdownRef.current = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setError("");
    const cleaned = phone.trim().replace(/\s/g, "");
    if (!cleaned) {
      setError("Please enter your phone number.");
      return;
    }
    setLoading(true);
    try {
      await api.auth.sendOtp(cleaned);
      setStep("otp");
      startCountdown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      setError(e.message ?? "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-verify when all filled
    if (value && index === 5 && next.every((d) => d)) {
      verifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const next = pasted.split("");
      setOtp(next);
      verifyOtp(pasted);
    }
  };

  const verifyOtp = async (code: string, name?: string) => {
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.verifyOtp({
        phone: phone.trim(),
        code,
        fullName: name ?? (fullName || undefined),
      });
      storage.setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      // Existing user with no fullName — must complete profile before ordering
      if (!data.user.fullName) {
        setIsNewUser(true);
        setStep("name");
        return;
      }

      router.replace(getRoleHome(data.user.role));
    } catch (e: any) {
      const msg: string = e.message ?? "Invalid code.";
      // Backend might indicate new user via a specific message
      if (msg.toLowerCase().includes("name") || msg.toLowerCase().includes("new")) {
        setIsNewUser(true);
        setStep("name");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.auth.updateProfile(fullName.trim());
      // Update the locally stored auth so the menu header shows the correct name
      const auth = storage.getAuth();
      if (auth) {
        storage.setAuth({ ...auth, user: { ...auth.user, fullName: fullName.trim() } });
      }
      router.replace(getRoleHome(auth?.user.role));
    } catch (e: any) {
      setError(e.message ?? "Failed to save name.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(255,107,43,0.1) 0%, transparent 60%), var(--bg-primary)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo */}
        <div
          className="animate-fade-in-up"
          style={{ textAlign: "center", marginBottom: "40px" }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "22px",
              background: "linear-gradient(135deg, #ff6b2b, #ff9a3c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              margin: "0 auto 16px",
              boxShadow: "0 10px 40px rgba(255,107,43,0.35)",
            }}
          >
            🍽️
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>
            {step === "phone" && "Sign in to order"}
            {step === "otp" && "Enter OTP"}
            {step === "name" && "What's your name?"}
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: "8px",
              fontSize: "0.9rem",
            }}
          >
            {step === "phone" && "We'll send a one-time password to your phone"}
            {step === "otp" && `Sent to ${phone}`}
            {step === "name" && "First time here? Let us know your name"}
          </p>
        </div>

        {/* Card */}
        <div
          className="glass animate-fade-in-up"
          style={{ animationDelay: "0.1s", padding: "28px" }}
        >
          {/* Phone step */}
          {step === "phone" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    color: "var(--text-secondary)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Phone Number
                </label>
                <input
                  className="input-field"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  style={{ padding: "14px 16px", fontSize: "1.05rem" }}
                  autoFocus
                />
              </div>

              {error && <ErrorMsg message={error} />}

              <button
                className="btn-accent"
                style={{ padding: "15px", fontSize: "1rem", borderRadius: "12px" }}
                onClick={handleSendOtp}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : "Send OTP →"}
              </button>
            </div>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    color: "var(--text-secondary)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginBottom: "16px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "center",
                  }}
                >
                  6-digit code
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "center",
                  }}
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      className={`otp-input ${digit ? "filled" : ""}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    />
                  ))}
                </div>
              </div>

              {error && <ErrorMsg message={error} />}

              <button
                className="btn-accent"
                style={{ padding: "15px", fontSize: "1rem", borderRadius: "12px" }}
                onClick={() => verifyOtp(otp.join(""))}
                disabled={loading || otp.join("").length < 6}
              >
                {loading ? <span className="spinner" /> : "Verify →"}
              </button>

              <div style={{ textAlign: "center" }}>
                {resendCountdown > 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    Resend in {resendCountdown}s
                  </p>
                ) : (
                  <button
                    className="btn-ghost"
                    style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    onClick={() => { setOtp(["","","","","",""]); handleSendOtp(); }}
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  textAlign: "center",
                }}
                onClick={() => { setStep("phone"); setOtp(["","","","","",""]); setError(""); }}
              >
                ← Change number
              </button>
            </div>
          )}

          {/* Name step */}
          {step === "name" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    color: "var(--text-secondary)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Your Name
                </label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                  style={{ padding: "14px 16px", fontSize: "1.05rem" }}
                  autoFocus
                />
              </div>

              {error && <ErrorMsg message={error} />}

              <button
                className="btn-accent"
                style={{ padding: "15px", fontSize: "1rem", borderRadius: "12px" }}
                onClick={handleNameSubmit}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : "Continue →"}
              </button>
            </div>
          )}
        </div>

        <p
          className="animate-fade-in-up"
          style={{
            animationDelay: "0.2s",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            textAlign: "center",
            marginTop: "20px",
            lineHeight: 1.6,
          }}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#ef4444",
        fontSize: "0.85rem",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span>⚠️</span>
      {message}
    </div>
  );
}
