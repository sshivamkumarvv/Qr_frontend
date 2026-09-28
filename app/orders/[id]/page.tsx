"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, Order, OrderStatus, storage } from "@/lib/api";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: string; color: string; bg: string }
> = {
  PENDING: { label: "Order Placed", icon: "📋", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  CONFIRMED: { label: "Confirmed", icon: "✅", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  PREPARING: { label: "Preparing", icon: "👨‍🍳", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  READY: { label: "Ready to Serve", icon: "🔔", color: "var(--accent)", bg: "rgba(255,107,43,0.1)" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", icon: "🛵", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  DELIVERED: { label: "Served", icon: "🎉", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  CANCELLED: { label: "Cancelled", icon: "❌", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const STATUS_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => {
    const auth = storage.getAuth();
    if (!auth) {
      router.replace("/auth");
      return;
    }
    fetchOrder();

    // Poll every 10s if order is active
    const interval = setInterval(() => {
      fetchOrder(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId, router]);

  const fetchOrder = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.orders.findOne(orderId);
      setOrder(data);
    } catch (e: any) {
      if (!silent) setError(e.message ?? "Failed to load order.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const updated = await api.orders.cancel(orderId);
      setOrder(updated);
      showToast("Order cancelled.", "error");
    } catch (e: any) {
      showToast(e.message ?? "Could not cancel order.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const showToast = (msg: string, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return <LoadingScreen />;
  if (error)
    return (
      <ErrorScreen
        message={error}
        onBack={() => router.push("/menu")}
      />
    );
  if (!order) return null;

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const canCancel = order.status === "PENDING";
  const tableInfo = storage.getTableInfo();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-primary)",
        padding: "0 0 40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg-header)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 20px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <button
          onClick={() => router.push("/menu")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.06)",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
          }}
        >
          ←
        </button>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: "1rem" }}>Order Details</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            #{orderId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <button
          onClick={() => router.push("/orders")}
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          My Orders
        </button>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
        {/* Status hero */}
        <div
          className="animate-fade-in-up"
          style={{
            textAlign: "center",
            padding: "32px 24px",
            borderRadius: "24px",
            background: cfg.bg,
            border: `1px solid ${cfg.color}30`,
            marginBottom: "24px",
          }}
        >
          <div
            className={order.status === "PREPARING" ? "animate-pulse-glow" : ""}
            style={{
              fontSize: "56px",
              marginBottom: "12px",
              display: "inline-block",
            }}
          >
            {cfg.icon}
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: cfg.color }}>
            {cfg.label}
          </h2>
          {order.status === "PREPARING" && (
            <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.9rem" }}>
              Our kitchen is working on your order ✨
            </p>
          )}
          {order.status === "READY" && (
            <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.9rem" }}>
              Your food is ready! A staff member will bring it to you. 🔔
            </p>
          )}
          {order.status === "DELIVERED" && (
            <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.9rem" }}>
              Enjoy your meal! 😋
            </p>
          )}

          {/* Table & Payment badges */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "16px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "100px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              🪑 Table {tableInfo?.tableNumber ?? order.tableNumber ?? "—"}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "100px",
                background:
                  order.paymentMethod === "online"
                    ? order.paymentStatus === "paid"
                      ? "rgba(34,197,94,0.12)"
                      : "rgba(245,158,11,0.12)"
                    : "rgba(255,255,255,0.06)",
                border: `1px solid ${
                  order.paymentMethod === "online"
                    ? order.paymentStatus === "paid"
                      ? "rgba(34,197,94,0.3)"
                      : "rgba(245,158,11,0.3)"
                    : "var(--border)"
                }`,
                fontSize: "0.82rem",
                fontWeight: 600,
                color:
                  order.paymentMethod === "online"
                    ? order.paymentStatus === "paid"
                      ? "#22c55e"
                      : "#f59e0b"
                    : "var(--text-secondary)",
              }}
            >
              {order.paymentMethod === "online"
                ? order.paymentStatus === "paid"
                  ? "💳 Paid Online"
                  : "⏳ Payment Pending"
                : "💵 Pay at Counter"}
            </div>
          </div>
        </div>

        {/* Progress tracker */}
        {order.status !== "CANCELLED" && (
          <div
            className="glass animate-fade-in-up"
            style={{ animationDelay: "0.1s", padding: "20px", marginBottom: "16px" }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "16px", fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Order Progress
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {STATUS_FLOW.map((s, i) => {
                const sCfg = STATUS_CONFIG[s];
                const isDone = i < currentIdx;
                const isActive = i === currentIdx;
                const isPending = i > currentIdx;
                return (
                  <div key={s}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "8px 0",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: isDone
                            ? "rgba(34,197,94,0.2)"
                            : isActive
                            ? `${sCfg.bg}`
                            : "rgba(255,255,255,0.04)",
                          border: `2px solid ${isDone ? "#22c55e" : isActive ? sCfg.color : "var(--border)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          flexShrink: 0,
                          transition: "all 0.3s",
                          boxShadow: isActive ? `0 0 16px ${sCfg.color}40` : "none",
                        }}
                      >
                        {isDone ? "✓" : sCfg.icon}
                      </div>
                      <div>
                        <p
                          style={{
                            fontWeight: isActive ? 700 : isPending ? 400 : 600,
                            color: isDone
                              ? "#22c55e"
                              : isActive
                              ? sCfg.color
                              : "var(--text-muted)",
                            fontSize: "0.9rem",
                          }}
                        >
                          {sCfg.label}
                        </p>
                        {isActive && (
                          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                            Current status
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <div style={{ marginLeft: "auto" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                            }}
                          >
                            {[0, 1, 2].map((d) => (
                              <div
                                key={d}
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: sCfg.color,
                                  animation: `dot-bounce 1.2s ease-in-out ${d * 0.2}s infinite`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div
                        style={{
                          width: "2px",
                          height: "20px",
                          background: isDone ? "#22c55e" : "var(--border)",
                          marginLeft: "17px",
                          borderRadius: "2px",
                          transition: "background 0.3s",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order items */}
        <div
          className="glass animate-fade-in-up"
          style={{ animationDelay: "0.2s", padding: "20px", marginBottom: "16px" }}
        >
          <h3
            style={{
              fontWeight: 600,
              marginBottom: "14px",
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Order Items
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {order.items?.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 500, fontSize: "0.9rem" }}>{item.menuItemName}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                    {item.portion ? `${item.portion} · ` : ""}₹{item.unitPrice} × {item.quantity}
                  </p>
                  {!!item.customization?.addOns?.length && (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: "3px" }}>
                      Add-ons: {item.customization.addOns.map((addon) => addon.name).join(", ")}
                    </p>
                  )}
                </div>
                <p style={{ fontWeight: 600, color: "var(--accent)" }}>
                  ₹{item.subtotal ?? item.unitPrice * item.quantity}
                </p>
              </div>
            ))}
          </div>

          {/* Bill */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {[
              { label: "Item Total (food GST incl.)", value: `₹${Number(order.subtotal ?? 0).toFixed(2)}` },
              ...(order.orderType === "dine_in"
                ? [
                    {
                      label: "Platform Convenience Fee (6%)",
                      value: `₹${Number(order.convenienceFee ?? (Number(order.subtotal ?? 0) * 0.06)).toFixed(2)}`,
                    },
                    {
                      label: "GST on Convenience Fee (18%)",
                      value: `₹${Number(order.taxAmount ?? (Number(order.subtotal ?? 0) * 0.06 * 0.18)).toFixed(2)}`,
                    },
                  ]
                : [
                    { label: "Tax (5%)", value: `₹${Number(order.taxAmount ?? 0).toFixed(2)}` },
                    ...(order.deliveryFee
                      ? [{ label: "Delivery", value: `₹${Number(order.deliveryFee).toFixed(2)}` }]
                      : []),
                  ]),
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {row.label}
                </span>
                <span style={{ fontSize: "0.85rem" }}>{row.value}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "8px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "1.05rem" }}>
                ₹{order.totalAmount ?? order.total ?? "—"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "6px",
                fontSize: "0.8rem",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Payment</span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    order.paymentMethod === "online"
                      ? order.paymentStatus === "paid"
                        ? "#22c55e"
                        : "#f59e0b"
                      : "var(--text-secondary)",
                }}
              >
                {order.paymentMethod === "online"
                  ? order.paymentStatus === "paid"
                    ? "Paid Online"
                    : "Pending"
                  : "Pay at Counter"}
              </span>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: "0.8rem",
              }}
            >
              📝 {order.notes}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s", display: "flex", flexDirection: "column", gap: "10px" }}>
          {order.paymentMethod === "online" && order.paymentStatus !== "paid" && order.status !== "CANCELLED" && (
            <button
              className="btn-accent tap-scale"
              style={{
                padding: "16px",
                fontSize: "1rem",
                borderRadius: "14px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 6px 24px rgba(255,107,43,0.4)",
              }}
              onClick={() => router.push(`/payment?orderId=${order.id}`)}
            >
              <span>💳</span>
              <span>Complete Payment · ₹{order.totalAmount ?? order.total}</span>
            </button>
          )}

          <button
            className="btn-accent"
            style={{ padding: "14px", fontSize: "0.95rem", borderRadius: "14px" }}
            onClick={() => router.push("/menu")}
          >
            Order More Items
          </button>

          {canCancel && (
            <button
              className="btn-ghost"
              style={{ padding: "14px", fontSize: "0.95rem", borderRadius: "14px" }}
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? <span className="spinner" style={{ borderTopColor: "var(--text-primary)" }} /> : "Cancel Order"}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </main>
  );
}

function LoadingScreen() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div className="spinner" style={{ width: "32px", height: "32px" }} />
      <p style={{ color: "var(--text-secondary)" }}>Loading order...</p>
    </main>
  );
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "48px" }}>⚠️</div>
      <p style={{ color: "var(--text-secondary)", maxWidth: "300px" }}>{message}</p>
      <button className="btn-accent" style={{ padding: "12px 24px", borderRadius: "12px" }} onClick={onBack}>
        Go Back
      </button>
    </main>
  );
}
