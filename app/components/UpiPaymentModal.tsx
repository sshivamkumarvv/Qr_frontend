"use client";

import React, { useEffect, useRef, useState } from "react";
import { api, CreateUpiIntentResponse, Order } from "@/lib/api";

interface UpiPaymentModalProps {
  orderId: string;
  totalAmount: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (order: Order) => void;
  onFallbackToRazorpay?: () => void;
}

export default function UpiPaymentModal({
  orderId,
  totalAmount,
  isOpen,
  onClose,
  onPaymentSuccess,
  onFallbackToRazorpay,
}: UpiPaymentModalProps) {
  const [upiData, setUpiData] = useState<CreateUpiIntentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [utr, setUtr] = useState("");
  const [showUtrInput, setShowUtrInput] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch UPI Intent details when opened
  useEffect(() => {
    if (!isOpen || !orderId) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    api.payments
      .createUpiIntent(orderId)
      .then((data) => {
        if (!isMounted) return;
        setUpiData(data);
        setLoading(false);

        // If on mobile device, try auto-opening the intent
        const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          );
        if (isMobile && data.upiUri) {
          // Open UPI intent directly to trigger device app chooser
          window.location.href = data.upiUri;
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to generate UPI intent. Please try again.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, orderId]);

  // 2. Active status polling while modal is open
  useEffect(() => {
    if (!isOpen || !orderId || verified) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const status = await api.payments.getPaymentStatus(orderId);
        if (status.isPaid) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setVerified(true);
          const verifyRes = await api.payments.verifyUpiPayment({ orderId });
          setTimeout(() => {
            onPaymentSuccess(verifyRes.order);
          }, 1000);
        }
      } catch {
        // quiet poll
      }
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, orderId, verified, onPaymentSuccess]);

  // Manual verify button
  const handleManualVerify = async () => {
    setVerifying(true);
    setError("");
    try {
      const res = await api.payments.verifyUpiPayment({
        orderId,
        transactionRef: upiData?.transactionRef,
        utr: utr.trim() || undefined,
      });

      setVerified(true);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setTimeout(() => {
        onPaymentSuccess(res.order);
      }, 1000);
    } catch (err: any) {
      setError(
        err.message ||
          "Payment verification in progress. If you just paid, please wait a few seconds and try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleLaunchApp = (appUrl: string) => {
    window.location.href = appUrl;
  };

  if (!isOpen) return null;

  const qrUrl = upiData?.upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
        upiData.upiUri
      )}`
    : "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "16px",
      }}
    >
      <div
        className="anim-scale-in"
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "var(--bg-secondary, #1a1a1a)",
          border: "1.5px solid var(--accent, #f59e0b)",
          borderRadius: "24px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxHeight: "90dvh",
          overflowY: "auto",
          color: "var(--text-primary, #ffffff)",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--text-secondary, #aaaaaa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 700,
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ paddingRight: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                textTransform: "uppercase",
                background: "var(--accent, #f59e0b)",
                color: "#000",
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              Direct UPI Intent
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>
              Order #{orderId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "6px 0 2px" }}>
            Pay ₹{totalAmount.toFixed(0)} via UPI
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary, #aaa)", margin: 0 }}>
            Select your installed UPI app or scan the QR code to pay instantly.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              className="spinner"
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid rgba(245,158,11,0.2)",
                borderTopColor: "var(--accent, #f59e0b)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted, #888)" }}>
              Preparing UPI Intent & QR Code…
            </p>
          </div>
        )}

        {/* Success Banner */}
        {verified && (
          <div
            style={{
              background: "rgba(34,197,94,0.15)",
              border: "1.5px solid #22c55e",
              borderRadius: "16px",
              padding: "16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "36px" }}>🎉</span>
            <h3 style={{ margin: 0, color: "#22c55e", fontSize: "1.1rem", fontWeight: 800 }}>
              Payment Verified Successfully!
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary, #ccc)" }}>
              ₹{totalAmount.toFixed(0)} received by bank. Confirming your order…
            </p>
          </div>
        )}

        {!loading && !verified && upiData && (
          <>
            {/* 1. App Launchers Grid (for mobile & direct click) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text-muted, #888)",
                  letterSpacing: "0.05em",
                }}
              >
                1. Tap to Open Installed App:
              </span>

              {/* Primary: Open Any Installed App (Triggers Android/iOS System Chooser) */}
              <button
                onClick={() => handleLaunchApp(upiData.upiUri)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                  border: "none",
                  color: "#000",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(245,158,11,0.35)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>📱</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ color: "#000", fontWeight: 900 }}>Open Installed UPI App</div>
                    <div style={{ fontSize: "0.74rem", color: "rgba(0,0,0,0.75)" }}>
                      Google Pay, PhonePe, Paytm, BHIM, Cred
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "18px" }}>→</span>
              </button>

              {/* Specific App Buttons */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  marginTop: "4px",
                }}
              >
                <button
                  onClick={() => handleLaunchApp(upiData.apps.phonepe)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "12px",
                    background: "rgba(95,37,159,0.15)",
                    border: "1px solid rgba(95,37,159,0.4)",
                    color: "#a855f7",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>💜</span>
                  <span>PhonePe</span>
                </button>

                <button
                  onClick={() => handleLaunchApp(upiData.apps.gpay)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "12px",
                    background: "rgba(66,133,244,0.15)",
                    border: "1px solid rgba(66,133,244,0.4)",
                    color: "#60a5fa",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>🔵</span>
                  <span>Google Pay</span>
                </button>

                <button
                  onClick={() => handleLaunchApp(upiData.apps.paytm)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "12px",
                    background: "rgba(0,186,242,0.15)",
                    border: "1px solid rgba(0,186,242,0.4)",
                    color: "#38bdf8",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>💠</span>
                  <span>Paytm</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                margin: "4px 0",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted, #777)", textTransform: "uppercase" }}>
                or scan QR code
              </span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
            </div>

            {/* 2. Dynamic QR Code Display */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                borderRadius: "18px",
                padding: "14px",
                alignSelf: "center",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
              }}
            >
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrUrl}
                  alt="UPI Payment QR Code"
                  width={200}
                  height={200}
                  style={{ display: "block", borderRadius: "8px" }}
                />
              ) : (
                <div style={{ width: 200, height: 200 }} />
              )}
              <div
                style={{
                  color: "#000000",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  marginTop: "8px",
                  textAlign: "center",
                }}
              >
                Scan with any UPI App · ₹{totalAmount.toFixed(0)}
              </div>
            </div>

            {/* Verification Status Pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "12px",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 10px #22c55e",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #ccc)" }}>
                Waiting for payment approval… Auto-verifying
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                  fontSize: "0.8rem",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {/* Verification Buttons */}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                onClick={handleManualVerify}
                disabled={verifying}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: verifying ? "not-allowed" : "pointer",
                }}
              >
                {verifying ? "Checking Bank Status…" : "I've Paid · Check Status"}
              </button>

              <button
                onClick={() => setShowUtrInput(!showUtrInput)}
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "var(--text-muted, #888)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {showUtrInput ? "Hide UTR" : "Enter UTR"}
              </button>
            </div>

            {/* UTR Input Form */}
            {showUtrInput && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  background: "rgba(0,0,0,0.3)",
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <input
                  type="text"
                  placeholder="12-digit UPI Ref / UTR"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                  maxLength={16}
                />
                <button
                  onClick={handleManualVerify}
                  disabled={!utr.trim() || verifying}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "var(--accent, #f59e0b)",
                    border: "none",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  Submit
                </button>
              </div>
            )}

            {/* Fallback to Razorpay */}
            {onFallbackToRazorpay && (
              <div style={{ textAlign: "center", marginTop: "4px" }}>
                <button
                  onClick={onFallbackToRazorpay}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted, #888)",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Prefer Credit/Debit Card or Netbanking? Pay with Razorpay
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
