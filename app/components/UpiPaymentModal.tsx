"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { api, CreateUpiIntentResponse, Order } from "@/lib/api";
import { processRazorpayPayment, PaymentCancelledError } from "@/lib/razorpay";

interface UpiPaymentModalProps {
  orderId: string;
  totalAmount: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (order: Order) => void;
  onFallbackToRazorpay?: () => void;
  restaurantName?: string;
  customerName?: string;
  customerPhone?: string;
}

export default function UpiPaymentModal({
  orderId,
  totalAmount,
  isOpen,
  onClose,
  onPaymentSuccess,
  onFallbackToRazorpay,
  restaurantName,
  customerName,
  customerPhone,
}: UpiPaymentModalProps) {
  const [upiData, setUpiData] = useState<CreateUpiIntentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [activeAppLoading, setActiveAppLoading] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError] = useState("");
  const [utr, setUtr] = useState("");
  const [showUtrInput, setShowUtrInput] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [activeTab, setActiveTab] = useState<"upi" | "cards" | "qr">("upi");
  const [isMobile, setIsMobile] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobile);
      if (!mobile) {
        setActiveTab("upi");
      }
    }
  }, []);

  // 1. Fetch UPI Details
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
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load payment methods. Please try again.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, orderId]);

  // Payment success handler
  const handlePaymentCompleted = useCallback(
    (order: Order) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setVerified(true);
      setTimeout(() => {
        onPaymentSuccess(order);
      }, 1000);
    },
    [onPaymentSuccess]
  );

  // 2. Active status polling
  useEffect(() => {
    if (!isOpen || !orderId || verified) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        // PhonePe check
        try {
          const pgRes = await api.payments.verifyPhonePePayment(orderId);
          if (pgRes.success && pgRes.status === "paid") {
            handlePaymentCompleted(pgRes.order);
            return;
          }
        } catch {
          // ignore
        }

        // General status check
        const status = await api.payments.getPaymentStatus(orderId);
        if (status.isPaid) {
          const verifyRes = await api.payments.verifyUpiPayment({ orderId });
          handlePaymentCompleted(verifyRes.order);
        }
      } catch {
        // silent
      }
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, orderId, verified, handlePaymentCompleted]);

  // Launch PhonePe PG (0% Fee, Verified)
  const handleLaunchPhonePe = async () => {
    setActiveAppLoading("phonepe");
    setError("");
    try {
      const res = await api.payments.createPhonePePayment(orderId, {
        redirectUrl: `${window.location.origin}/checkout?orderId=${orderId}&payment=phonepe`,
      });

      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      }
    } catch {
      if (upiData?.apps.phonepe) {
        window.location.href = upiData.apps.phonepe;
      } else {
        setError("Could not open PhonePe directly. Please scan the QR code.");
      }
    } finally {
      setActiveAppLoading(null);
    }
  };

  // Launch Google Pay
  const handleLaunchGPay = () => {
    setActiveAppLoading("gpay");
    if (upiData?.apps.gpay) {
      window.location.href = upiData.apps.gpay;
    } else if (upiData?.upiUri) {
      window.location.href = upiData.upiUri;
    }
    setTimeout(() => setActiveAppLoading(null), 1200);
  };

  // Launch Paytm
  const handleLaunchPaytm = () => {
    setActiveAppLoading("paytm");
    if (upiData?.apps.paytm) {
      window.location.href = upiData.apps.paytm;
    } else if (upiData?.upiUri) {
      window.location.href = upiData.upiUri;
    }
    setTimeout(() => setActiveAppLoading(null), 1200);
  };

  // Generic Intent
  const handleLaunchGenericUpi = () => {
    if (upiData?.upiUri) {
      window.location.href = upiData.upiUri;
    }
  };

  // Launch Cards / Net Banking / Wallets via Razorpay Checkout
  const handlePayCardsOrNetbanking = async (preferredInstrument?: string) => {
    setCardLoading(true);
    setError("");
    try {
      const verifiedOrder = await processRazorpayPayment({
        order: {
          id: orderId,
          restaurantName: restaurantName || "Restaurant Dine-In",
          customerName: customerName || "Customer",
          customerPhone: customerPhone || "9999999999",
          total: totalAmount,
          totalAmount: totalAmount,
        },
      });

      handlePaymentCompleted(verifiedOrder);
    } catch (err: any) {
      if (err instanceof PaymentCancelledError) {
        // User closed modal
      } else {
        setError(err.message || "Card/Netbanking payment failed. Please try again.");
      }
    } finally {
      setCardLoading(false);
    }
  };

  // Manual UTR Verification
  const handleManualVerify = async () => {
    setVerifying(true);
    setError("");
    try {
      try {
        const phonePeRes = await api.payments.verifyPhonePePayment(orderId);
        if (phonePeRes.success && phonePeRes.status === "paid") {
          handlePaymentCompleted(phonePeRes.order);
          return;
        } else if (phonePeRes.status === "failed") {
          setError(phonePeRes.message || "Payment declined or failed at the bank.");
          setVerifying(false);
          return;
        }
      } catch {
        // ignore
      }

      const res = await api.payments.verifyUpiPayment({
        orderId,
        transactionRef: upiData?.transactionRef,
        utr: utr.trim() || undefined,
      });

      handlePaymentCompleted(res.order);
    } catch (err: any) {
      setError(
        err.message ||
          "Payment verification in progress. If you just paid, please wait a few seconds and try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const copyUpiId = () => {
    if (upiData?.merchantVpa) {
      navigator.clipboard.writeText(upiData.merchantVpa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  if (!isOpen) return null;

  const qrUrl = upiData?.upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
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
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "16px",
      }}
    >
      <div
        className="anim-scale-in"
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
          border: "1.5px solid rgba(245, 158, 11, 0.35)",
          borderRadius: "28px",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.85), 0 0 45px rgba(245, 158, 11, 0.12)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          maxHeight: "92dvh",
          overflowY: "auto",
          color: "#ffffff",
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
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#9ca3af",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s",
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header with Amount & Badges */}
        <div style={{ paddingRight: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "rgba(34, 197, 94, 0.15)",
                color: "#4ade80",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              ⚡ 0% UPI Fee
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              💳 Cards & NetBanking
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "rgba(245, 158, 11, 0.12)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              🔒 100% Safe
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 900, margin: 0, color: "#ffffff" }}>
              ₹{totalAmount.toFixed(0)}
            </h2>
            <span style={{ fontSize: "0.82rem", color: "#9ca3af" }}>Total Amount to Pay</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                border: "3px solid rgba(245,158,11,0.2)",
                borderTopColor: "#f59e0b",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", margin: 0 }}>
              Loading all secure payment gateways…
            </p>
          </div>
        )}

        {/* Verified Celebration Screen */}
        {verified && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(16,185,129,0.1) 100%)",
              border: "1.5px solid #22c55e",
              borderRadius: "22px",
              padding: "28px 16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(34,197,94,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "30px",
                border: "2px solid #22c55e",
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: 0, color: "#4ade80", fontSize: "1.25rem", fontWeight: 900 }}>
              Payment Verified!
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#d1d5db" }}>
              ₹{totalAmount.toFixed(0)} confirmed by your bank. Processing order…
            </p>
          </div>
        )}

        {!loading && !verified && upiData && (
          <>
            {/* Top Multi-Category Tabs (Like Swiggy / Zomato) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                background: "rgba(255,255,255,0.05)",
                padding: "3px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                gap: "2px",
              }}
            >
              <button
                onClick={() => setActiveTab("upi")}
                style={{
                  padding: "9px 6px",
                  borderRadius: "11px",
                  border: "none",
                  background: activeTab === "upi" ? "#f59e0b" : "transparent",
                  color: activeTab === "upi" ? "#000000" : "#9ca3af",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <span>⚡</span>
                <span>UPI Apps</span>
              </button>

              <button
                onClick={() => setActiveTab("cards")}
                style={{
                  padding: "9px 6px",
                  borderRadius: "11px",
                  border: "none",
                  background: activeTab === "cards" ? "#f59e0b" : "transparent",
                  color: activeTab === "cards" ? "#000000" : "#9ca3af",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <span>💳</span>
                <span>Cards & Bank</span>
              </button>

              <button
                onClick={() => setActiveTab("qr")}
                style={{
                  padding: "9px 6px",
                  borderRadius: "11px",
                  border: "none",
                  background: activeTab === "qr" ? "#f59e0b" : "transparent",
                  color: activeTab === "qr" ? "#000000" : "#9ca3af",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <span>📷</span>
                <span>Scan QR</span>
              </button>
            </div>

            {/* ════════════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: UPI APPS (PhonePe, GPay, Paytm, BHIM, Cred)                       */}
            {/* ════════════════════════════════════════════════════════════════════════ */}
            {activeTab === "upi" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* 1. Primary "Open Any Installed UPI App" button */}
                <button
                  onClick={handleLaunchGenericUpi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                    border: "none",
                    color: "#000000",
                    fontWeight: 900,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    boxShadow: "0 8px 25px rgba(245, 158, 11, 0.35)",
                    transition: "transform 0.1s",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "22px" }}>🚀</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "#000000", fontWeight: 900 }}>Open Installed UPI App</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(0,0,0,0.8)" }}>
                        PhonePe · Google Pay · Paytm · BHIM · Cred
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: 900 }}>→</span>
                </button>

                {/* 2. Quick 1-Tap App Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {/* PhonePe */}
                  <button
                    onClick={handleLaunchPhonePe}
                    disabled={activeAppLoading === "phonepe"}
                    style={{
                      padding: "12px 6px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, rgba(95,37,159,0.3) 0%, rgba(147,51,234,0.15) 100%)",
                      border: "1.5px solid rgba(168,85,247,0.5)",
                      color: "#c084fc",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: activeAppLoading === "phonepe" ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      boxShadow: "0 4px 15px rgba(147,51,234,0.12)",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>💜</span>
                    <span>{activeAppLoading === "phonepe" ? "Opening…" : "PhonePe"}</span>
                    <span style={{ fontSize: "0.6rem", color: "#4ade80", fontWeight: 800 }}>Verified · 0%</span>
                  </button>

                  {/* Google Pay */}
                  <button
                    onClick={handleLaunchGPay}
                    disabled={activeAppLoading === "gpay"}
                    style={{
                      padding: "12px 6px",
                      borderRadius: "14px",
                      background: "rgba(66,133,244,0.15)",
                      border: "1.5px solid rgba(66,133,244,0.45)",
                      color: "#60a5fa",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: activeAppLoading === "gpay" ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>🔵</span>
                    <span>{activeAppLoading === "gpay" ? "Opening…" : "Google Pay"}</span>
                    <span style={{ fontSize: "0.6rem", color: "#4ade80", fontWeight: 800 }}>Verified · 0%</span>
                  </button>

                  {/* Paytm */}
                  <button
                    onClick={handleLaunchPaytm}
                    disabled={activeAppLoading === "paytm"}
                    style={{
                      padding: "12px 6px",
                      borderRadius: "14px",
                      background: "rgba(0,186,242,0.15)",
                      border: "1.5px solid rgba(0,186,242,0.45)",
                      color: "#38bdf8",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: activeAppLoading === "paytm" ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>💠</span>
                    <span>{activeAppLoading === "paytm" ? "Opening…" : "Paytm"}</span>
                    <span style={{ fontSize: "0.6rem", color: "#4ade80", fontWeight: 800 }}>Verified · 0%</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: CARDS, NET BANKING & WALLETS (Razorpay Gateway)                  */}
            {/* ════════════════════════════════════════════════════════════════════════ */}
            {activeTab === "cards" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* 1. Credit & Debit Cards Option */}
                <div
                  onClick={() => handlePayCardsOrNetbanking("card")}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: cardLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "12px",
                        background: "rgba(59,130,246,0.15)",
                        border: "1px solid rgba(59,130,246,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      💳
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#ffffff" }}>
                        Credit / Debit Card
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                        Visa, MasterCard, RuPay, Maestro, Amex
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={cardLoading}
                    style={{
                      background: "#f59e0b",
                      border: "none",
                      color: "#000000",
                      fontWeight: 800,
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    {cardLoading ? "Loading…" : "Pay →"}
                  </button>
                </div>

                {/* 2. Net Banking Option */}
                <div
                  onClick={() => handlePayCardsOrNetbanking("netbanking")}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: cardLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "12px",
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      🏦
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#ffffff" }}>
                        Net Banking
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                        HDFC, ICICI, SBI, Axis, Kotak + 50 Banks
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={cardLoading}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#ffffff",
                      fontWeight: 800,
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    Select Bank
                  </button>
                </div>

                {/* 3. Wallets & Pay Later */}
                <div
                  onClick={() => handlePayCardsOrNetbanking("wallet")}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: cardLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "12px",
                        background: "rgba(245,158,11,0.15)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      👛
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#ffffff" }}>
                        Wallets & Other
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                        Amazon Pay, Mobikwik, Airtel Money
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={cardLoading}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#ffffff",
                      fontWeight: 800,
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: SCAN QR CODE                                                     */}
            {/* ════════════════════════════════════════════════════════════════════════ */}
            {activeTab === "qr" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    padding: "12px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrUrl}
                      alt="UPI QR Code"
                      width={185}
                      height={185}
                      style={{ display: "block", borderRadius: "10px" }}
                    />
                  ) : (
                    <div style={{ width: 185, height: 185 }} />
                  )}
                  <div
                    style={{
                      color: "#000000",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      marginTop: "6px",
                      textAlign: "center",
                    }}
                  >
                    Scan with PhonePe, GPay, or Paytm
                  </div>
                </div>

                {/* Copyable UPI ID */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "8px 12px",
                    fontSize: "0.78rem",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>UPI ID / VPA</span>
                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{upiData.merchantVpa}</span>
                  </div>
                  <button
                    onClick={copyUpiId}
                    style={{
                      background: copiedUpi ? "#22c55e" : "rgba(245,158,11,0.2)",
                      border: `1px solid ${copiedUpi ? "#22c55e" : "#f59e0b"}`,
                      color: copiedUpi ? "#000000" : "#fbbf24",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {copiedUpi ? "Copied! ✓" : "Copy UPI"}
                  </button>
                </div>
              </div>
            )}

            {/* Live Auto-Verification Radar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "14px",
                background: "rgba(245, 158, 11, 0.06)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 12px #22c55e",
                  animation: "pulse 1.8s infinite",
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "#d1d5db" }}>
                Auto-verifying payment with bank… (~2-4 seconds)
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#fca5a5",
                  fontSize: "0.8rem",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {/* Action Buttons: Manual Status Check & UTR Option */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleManualVerify}
                disabled={verifying}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: verifying ? "not-allowed" : "pointer",
                }}
              >
                {verifying ? "Checking Bank Status…" : "I've Paid · Check Status"}
              </button>

              <button
                onClick={() => setShowUtrInput(!showUtrInput)}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#9ca3af",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {showUtrInput ? "Hide UTR" : "Enter UTR"}
              </button>
            </div>

            {/* UTR Input Drawer */}
            {showUtrInput && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  background: "rgba(0,0,0,0.4)",
                  padding: "10px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <input
                  type="text"
                  placeholder="12-digit UPI Ref / UTR"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#ffffff",
                    fontSize: "0.84rem",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleManualVerify}
                  disabled={verifying || utr.length < 6}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    background: "#f59e0b",
                    border: "none",
                    color: "#000000",
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    cursor: verifying || utr.length < 6 ? "not-allowed" : "pointer",
                    opacity: utr.length < 6 ? 0.5 : 1,
                  }}
                >
                  Submit
                </button>
              </div>
            )}

            {/* Footer Trust Guarantee */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.72rem",
                color: "#6b7280",
                marginTop: "2px",
              }}
            >
              <span>🔒 256-Bit SSL</span>
              <span>·</span>
              <span>RBI Regulated</span>
              <span>·</span>
              <span>Instant Refunds</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
