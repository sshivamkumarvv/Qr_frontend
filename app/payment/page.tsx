"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Order, PaymentMethod, storage } from "@/lib/api";
import { PaymentCancelledError, processRazorpayPayment } from "@/lib/razorpay";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [user, setUser] = useState<{ fullName: string; phone: string } | null>(null);

  useEffect(() => {
    const auth = storage.getAuth();
    if (!auth) {
      router.replace("/auth");
      return;
    }
    setUser(auth.user);

    if (!orderId) {
      setError("No order ID provided.");
      setLoading(false);
      return;
    }

    loadOrder();
  }, [orderId, router]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError("");
      const data = await api.orders.findOne(orderId);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || "Failed to load order details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!order) return;
    setErrorMessage("");
    setPaying(true);

    try {
      const updatedOrder = await processRazorpayPayment({
        order: {
          id: order.id,
          restaurantName: order.restaurantName || order.branch?.name,
          customerName: order.customerName || user?.fullName,
          customerPhone: order.customerPhone || user?.phone,
          total: order.totalAmount ?? order.total,
        },
        user,
      });

      setOrder(updatedOrder);
      router.push(`/checkout?orderId=${order.id}&payment=success`);
    } catch (err: any) {
      if (err instanceof PaymentCancelledError) {
        setErrorMessage("Payment was cancelled. You can try again whenever you are ready.");
      } else {
        setErrorMessage(
          err.message ||
            "Payment could not be confirmed. If money was deducted, it will automatically reflect in order tracking."
        );
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <PaymentLoadingScreen />;
  }

  if (error || !order) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "52px" }}>⚠️</div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Order Not Found</h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: "340px", fontSize: "0.9rem" }}>
          {error || "We couldn't load details for this order."}
        </p>
        <button
          className="btn-accent"
          style={{ padding: "12px 28px", borderRadius: "12px", marginTop: "8px" }}
          onClick={() => router.push("/orders")}
        >
          View My Orders
        </button>
      </main>
    );
  }

  const isOnline = order.paymentMethod === "online";
  const isPaid = order.paymentStatus === "paid";
  const total = Number(order.totalAmount ?? order.total ?? 0);
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.taxAmount ?? 0);
  const tableNumber = order.tableNumber ?? storage.getTableInfo()?.tableNumber;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-primary)",
        paddingBottom: "48px",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          background: "var(--bg-header)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 20px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => router.push(`/orders/${order.id}`)}
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.15rem",
          }}
          aria-label="Back"
        >
          ←
        </button>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontWeight: 800, fontSize: "1.05rem" }}>Checkout & Payment</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <button
          onClick={() => router.push("/orders")}
          style={{
            padding: "6px 14px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          My Orders
        </button>
      </header>

      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Order Confirmed Banner */}
        <div
          className="glass animate-fade-in-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "16px 18px",
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: "20px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(34,197,94,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              flexShrink: 0,
            }}
          >
            ✅
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontWeight: 800, fontSize: "1rem", color: "#22c55e" }}>
              Order Confirmed!
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: "2px" }}>
              Order #{order.id.slice(0, 8).toUpperCase()}
              {tableNumber ? ` · Table ${tableNumber}` : ""}
            </p>
          </div>
          <div
            style={{
              padding: "5px 10px",
              borderRadius: "100px",
              background: isOnline ? "rgba(255,107,43,0.12)" : "rgba(34,197,94,0.12)",
              border: `1px solid ${isOnline ? "rgba(255,107,43,0.3)" : "rgba(34,197,94,0.3)"}`,
              color: isOnline ? "var(--accent)" : "#22c55e",
              fontSize: "0.72rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {isOnline ? "💳 Pay Online" : "💵 Pay at Counter"}
          </div>
        </div>

        {/* Table / Dine-in Info Card */}
        {tableNumber && (
          <div
            className="glass animate-fade-in-up"
            style={{
              padding: "16px 18px",
              borderRadius: "18px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(255,107,43,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              🪑
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Dining Table
              </p>
              <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                Table {tableNumber} {order.branch?.name ? `(${order.branch.name})` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Payment Status Card */}
        {isOnline ? (
          <div
            className="glass animate-fade-in-up"
            style={{
              padding: "20px",
              borderRadius: "20px",
              background: isPaid ? "rgba(34,197,94,0.06)" : "rgba(245,158,11,0.06)",
              border: `1px solid ${isPaid ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: isPaid ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                }}
              >
                {isPaid ? "✓" : "⏳"}
              </div>
              <h3
                style={{
                  fontWeight: 800,
                  fontSize: "0.98rem",
                  color: isPaid ? "#22c55e" : "#f59e0b",
                }}
              >
                {isPaid ? "Payment Complete" : "Payment Pending"}
              </h3>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
              {isPaid
                ? `Your payment has been received and confirmed. Order is being processed by the kitchen!`
                : `Tap "Pay Now" below to securely complete your payment via Razorpay (UPI, Credit/Debit Card, Netbanking).`}
            </p>
            {order.paymentId && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "8px" }}>
                Payment Ref: {order.paymentId}
              </p>
            )}
          </div>
        ) : (
          <div
            className="glass animate-fade-in-up"
            style={{
              padding: "20px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                }}
              >
                💵
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "0.98rem" }}>Pay at Counter</h3>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
              You can settle the bill directly at the counter with cash or card after enjoying your meal.
            </p>
          </div>
        )}

        {/* Bill Summary */}
        <div
          className="glass animate-fade-in-up"
          style={{
            padding: "20px",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <h3
            style={{
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Bill Summary
          </h3>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Items Subtotal</span>
            <span style={{ fontWeight: 500 }}>₹{subtotal.toFixed(0)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>GST & Restaurant Tax</span>
            <span style={{ fontWeight: 500 }}>₹{tax.toFixed(0)}</span>
          </div>

          <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>Total Amount</span>
            <span
              style={{
                fontWeight: 900,
                fontSize: "1.45rem",
                color: "var(--accent)",
                letterSpacing: "-0.02em",
              }}
            >
              ₹{total.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div
            className="animate-fade-in-up"
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
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
            <span style={{ flex: 1 }}>{errorMessage}</span>
          </div>
        )}

        {/* Action Button */}
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {isOnline && !isPaid ? (
            <button
              className="btn-accent tap-scale"
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "1rem",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontWeight: 800,
                boxShadow: "0 8px 28px rgba(255,107,43,0.45)",
                cursor: paying ? "not-allowed" : "pointer",
                opacity: paying ? 0.75 : 1,
              }}
              onClick={handlePayNow}
              disabled={paying}
            >
              {paying ? (
                <>
                  <span className="spinner" style={{ width: "20px", height: "20px" }} />
                  <span>Opening Razorpay...</span>
                </>
              ) : (
                <>
                  <span>🔒</span>
                  <span>Pay ₹{total.toFixed(0)} Securely</span>
                </>
              )}
            </button>
          ) : (
            <button
              className="btn-accent tap-scale"
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "1rem",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontWeight: 800,
                boxShadow: "0 8px 28px rgba(255,107,43,0.45)",
              }}
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <span>🍽️</span>
              <span>Track Order Progress</span>
            </button>
          )}

          {isOnline && !isPaid && (
            <button
              className="btn-ghost tap-scale"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                fontSize: "0.9rem",
              }}
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              View Order Details & Pay Later
            </button>
          )}
        </div>

        {/* Razorpay Trust Seal */}
        <div
          style={{
            textAlign: "center",
            marginTop: "16px",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>🔒</span>
          <span>Secured by Razorpay · 256-bit SSL encryption</span>
        </div>
      </div>
    </main>
  );
}

function PaymentLoadingScreen() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div className="spinner" style={{ width: "36px", height: "36px" }} />
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        Loading payment details...
      </p>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoadingScreen />}>
      <PaymentContent />
    </Suspense>
  );
}
