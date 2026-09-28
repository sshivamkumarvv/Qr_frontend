"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Order, OrderStatus, storage } from "@/lib/api";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Served",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#22c55e",
  PREPARING: "#3b82f6",
  READY: "var(--accent)",
  OUT_FOR_DELIVERY: "#3b82f6",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ fullName: string; phone: string } | null>(null);

  useEffect(() => {
    const auth = storage.getAuth();
    if (!auth) {
      router.replace("/auth");
      return;
    }
    setUser(auth.user);

    api.orders
      .findMy()
      .then((data) => setOrders(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    storage.clearAuth();
    router.replace("/auth");
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-primary)",
        paddingBottom: "40px",
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
        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 700, fontSize: "1rem" }}>My Orders</h1>
          {user && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              {user.fullName}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 500,
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "120px", borderRadius: "16px" }} />
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "20px",
              borderRadius: "16px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ fontSize: "56px" }}>🍽️</div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>No orders yet</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Browse the menu and place your first order!
            </p>
            <button
              className="btn-accent"
              style={{ padding: "12px 28px", borderRadius: "12px" }}
              onClick={() => router.push("/menu")}
            >
              Browse Menu
            </button>
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {orders.map((order, i) => (
              <OrderCard
                key={order.id}
                order={order}
                delay={i * 0.05}
                onClick={() => router.push(`/orders/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function OrderCard({
  order,
  delay,
  onClick,
}: {
  order: Order;
  delay: number;
  onClick: () => void;
}) {
  const color = STATUS_COLORS[order.status] ?? "var(--text-secondary)";
  const label = STATUS_LABELS[order.status] ?? order.status;

  const date = new Date(order.createdAt);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div
      className="glass animate-fade-in-up"
      style={{
        animationDelay: `${delay}s`,
        padding: "18px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            Order #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            {dateStr} at {timeStr}
            {order.tableNumber && ` · Table ${order.tableNumber}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
          {order.paymentMethod === "online" ? (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "100px",
                background: order.paymentStatus === "paid" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${order.paymentStatus === "paid" ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
                color: order.paymentStatus === "paid" ? "#22c55e" : "#f59e0b",
                fontSize: "0.68rem",
                fontWeight: 600,
              }}
            >
              {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
            </span>
          ) : (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "100px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: "0.68rem",
                fontWeight: 600,
              }}
            >
              Cash
            </span>
          )}
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "100px",
              background: `${color}18`,
              border: `1px solid ${color}35`,
              color: color,
              fontSize: "0.72rem",
              fontWeight: 600,
            }}
          >
            {label}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        {order.items?.slice(0, 3).map((item) => (
          <span
            key={item.id}
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
            }}
          >
            {item.menuItemName} ×{item.quantity}
          </span>
        ))}
        {order.items?.length > 3 && (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            +{order.items.length - 3} more
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>
          ₹{order.totalAmount ?? order.total}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
          View details →
        </span>
      </div>
    </div>
  );
}
