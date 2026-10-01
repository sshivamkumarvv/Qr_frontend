"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, storage, TableInfo, MenuItem } from "@/lib/api";
import { useCart } from "@/lib/useCart";
import { MenuCard } from "./menu/components/MenuCard";
import { InlinePairingStrip } from "./menu/components/InlinePairingStrip";
import { Sparkles, ShoppingBag, ArrowRight, UtensilsCrossed, X, Plus, Minus, ChevronRight, Eye } from "lucide-react";

// ─── Suspense wrapper required for useSearchParams in Next.js ─────────────────
export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeContent />
    </Suspense>
  );
}

type LocationStatus =
  | "idle"
  | "checking_permission"
  | "requesting"
  | "verified"
  | "out_of_range"
  | "denied"
  | "error";

function HomeContent() {
  const router = useRouter();
  const params = useSearchParams();

  const urlToken = params.get("token")?.trim();
  const token =
    urlToken ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("qrToken") || localStorage.getItem("qrToken")
      : null) ||
    "2374384b7a6b94d88a87437d0200511b";

  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [error, setError] = useState("");

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState("");

  const { cart, addItem, removeItem, getQty, totalItems, totalPrice } = useCart();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pairingItem, setPairingItem] = useState<MenuItem | null>(null);

  // Liquid glass modal states
  const [showCartQuickView, setShowCartQuickView] = useState(false);
  const [showMenuPopup, setShowMenuPopup] = useState(false);

  // Derive categories from items for clean menu popup
  const categories = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    map.set("ALL", { id: "ALL", name: "All Dishes", count: items.filter((i) => i.isAvailable).length });
    items.forEach((item) => {
      if (item.category && item.isAvailable) {
        const existing = map.get(item.category.id);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(item.category.id, { id: item.category.id, name: item.category.name, count: 1 });
        }
      }
    });
    return Array.from(map.values());
  }, [items]);

  // Function to re-resolve or update table info with specific coordinates
  const resolveTableWithLocation = useCallback(
    async (lat?: number, lng?: number) => {
      if (!token) return;
      try {
        const info = await api.tables.resolve(token, lat, lng);
        storage.setTableInfo(info);
        sessionStorage.setItem("qrToken", info.qrToken || token);
        localStorage.setItem("qrToken", info.qrToken || token);

        if (lat != null && lng != null) {
          sessionStorage.setItem("userLat", String(lat));
          sessionStorage.setItem("userLng", String(lng));
        }

        setTableInfo(info);

        // Fetch available menu items for home page exploration
        api.menu
          .list(info.restaurantId, info.branchId)
          .then(setItems)
          .catch(() => {});

        if (info.isWithinRange === true) {
          setLocationStatus("verified");
          setLocationError("");
        } else if (info.isWithinRange === false) {
          setLocationStatus("out_of_range");
          setLocationError(
            `You appear to be ~${info.distanceMeters}m away. Dine-in orders require being within 200m of the branch.`
          );
        } else if (lat != null && lng != null) {
          setLocationStatus("verified");
        }
        return info;
      } catch (e: any) {
        throw e;
      }
    },
    [token]
  );

  // Request actual geolocation from browser
  const handleRequestLocation = useCallback(async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("error");
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setLocationStatus("requesting");
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          await resolveTableWithLocation(lat, lng);
        } catch (e: any) {
          setLocationStatus("error");
          setLocationError(e.message ?? "Failed to verify location with server.");
        }
      },
      (err) => {
        let msg = "Could not obtain your location.";
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus("denied");
          msg = "Location permission was denied. Please allow location in your browser settings to verify your table.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationStatus("error");
          msg = "GPS signal unavailable. Please ensure location services are enabled on your device.";
        } else if (err.code === err.TIMEOUT) {
          setLocationStatus("error");
          msg = "Location request timed out. Please try again.";
        } else {
          setLocationStatus("error");
        }
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [resolveTableWithLocation]);

  // Initial load
  useEffect(() => {
    if (!token) {
      setError("No QR token found. Please scan your table's QR code.");
      setState("error");
      return;
    }

    const init = async () => {
      try {
        // Check if we already have saved coordinates in this session
        const storedLat = sessionStorage.getItem("userLat");
        const storedLng = sessionStorage.getItem("userLng");
        let initialLat: number | undefined = storedLat ? parseFloat(storedLat) : undefined;
        let initialLng: number | undefined = storedLng ? parseFloat(storedLng) : undefined;

        if (isNaN(initialLat as number)) initialLat = undefined;
        if (isNaN(initialLng as number)) initialLng = undefined;

        // Resolve table details first
        const info = await resolveTableWithLocation(initialLat, initialLng);
        setState("ready");

        // If server confirms range is verified (test mode or within range), skip GPS prompt
        if (info?.isWithinRange === true) {
          setLocationStatus("verified");
        } else if (initialLat == null || initialLng == null) {
          handleRequestLocation();
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to resolve table.");
        setState("error");
      }
    };

    init();
  }, [token, resolveTableWithLocation, handleRequestLocation]);

  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);

  // Auto-redirect timer when table is ready AND location is verified (pause if interacting with food items)
  useEffect(() => {
    if (state !== "ready" || locationStatus !== "verified" || pairingItem !== null || totalItems > 0) {
      setAutoRedirectCountdown(null);
      return;
    }

    // Start 3s countdown to show menu once verified
    let remaining = 3;
    setAutoRedirectCountdown(remaining);

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        router.push("/menu");
      } else {
        setAutoRedirectCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, locationStatus, pairingItem, totalItems, router]);

  const handleContinue = () => {
    if (locationStatus !== "verified") {
      handleRequestLocation();
      return;
    }
    router.push("/menu");
  };

  if (state === "loading") return <LoadingScreen />;
  if (state === "error") return <ErrorScreen message={error} />;

  const restaurantName = tableInfo?.restaurantName || tableInfo?.branchName || "Restaurant";
  const restaurantInitial = (restaurantName || "R").charAt(0).toUpperCase();

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(255,107,43,0.14) 0%, transparent 65%), var(--bg-primary)",
      }}
    >
      {/* Decorative background blobs */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          right: "-20%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,107,43,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-20%",
          left: "-20%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,154,60,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* Restaurant Logo & Table Welcome Card */}
        <div
          className="animate-fade-in-up"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "14px",
            width: "100%",
          }}
        >
          {/* Logo container */}
          <div
            style={{
              position: "relative",
              width: "96px",
              height: "96px",
              borderRadius: "28px",
              padding: "4px",
              background: "linear-gradient(135deg, rgba(255,107,43,0.6), rgba(255,154,60,0.2))",
              boxShadow: "0 16px 40px rgba(255,107,43,0.32)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "24px",
                overflow: "hidden",
                background: "#161622",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {tableInfo?.restaurantLogo ? (
                <img
                  src={tableInfo.restaurantLogo}
                  alt={restaurantName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    // Fallback to stylized initial if image fails
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: 900,
                    color: "var(--accent)",
                    letterSpacing: "-1px",
                  }}
                >
                  {restaurantInitial}
                </div>
              )}
            </div>

            {/* Floating Table Mini-Badge */}
            <div
              style={{
                position: "absolute",
                bottom: "-6px",
                right: "-6px",
                background: "linear-gradient(135deg, #ff6b2b, #ff9a3c)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "100px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                border: "2px solid #0f0f14",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <span>🪑</span>
              <span>{tableInfo?.tableNumber}</span>
            </div>
          </div>

          {/* Restaurant Title & Branch */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Welcome to
            </span>
            <h1
              className="gradient-text"
              style={{
                fontSize: "2rem",
                fontWeight: 900,
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {restaurantName}
            </h1>
            {tableInfo?.branchName && tableInfo.branchName !== restaurantName && (
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                {tableInfo.branchName} Branch
              </p>
            )}
          </div>
        </div>

        {/* Assigned Table Highlight Card */}
        <div
          className="glass animate-fade-in-up"
          style={{
            animationDelay: "0.1s",
            width: "100%",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "18px",
            border: "1.5px solid rgba(255,107,43,0.35)",
            background: "rgba(255,107,43,0.06)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "rgba(255,107,43,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              🪑
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Seated at
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff" }}>
                Table {tableInfo?.tableNumber}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background:
                locationStatus === "verified"
                  ? "rgba(34,197,94,0.15)"
                  : locationStatus === "requesting"
                  ? "var(--accent-bg)"
                  : "rgba(239,68,68,0.15)",
              color:
                locationStatus === "verified"
                  ? "#22c55e"
                  : locationStatus === "requesting"
                  ? "var(--accent)"
                  : "#ef4444",
              border: `1px solid ${
                locationStatus === "verified"
                  ? "rgba(34,197,94,0.3)"
                  : locationStatus === "requesting"
                  ? "var(--accent-border)"
                  : "rgba(239,68,68,0.3)"
              }`,
              fontSize: "0.76rem",
              padding: "5px 10px",
              borderRadius: "20px",
              fontWeight: 700,
            }}
          >
            <span>{locationStatus === "verified" ? "✓" : locationStatus === "requesting" ? "⏳" : "📍"}</span>
            <span>
              {locationStatus === "verified"
                ? "Dine-in Verified"
                : locationStatus === "requesting"
                ? "Checking Location..."
                : "Location Required"}
            </span>
          </div>
        </div>

        {/* Auto-redirect indicator & direct CTA */}
        <div
          className="animate-fade-in-up"
          style={{
            animationDelay: "0.15s",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <button
            onClick={handleContinue}
            className="btn-accent tap-scale"
            disabled={locationStatus === "requesting"}
            style={{
              width: "100%",
              padding: "16px 20px",
              fontSize: "1.05rem",
              fontWeight: 800,
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: "0 10px 30px var(--accent-glow)",
              cursor: locationStatus === "requesting" ? "wait" : "pointer",
            }}
          >
            {locationStatus === "verified" ? (
              <>
                <span>View Menu & Order</span>
                <span style={{ fontSize: "1.2rem" }}>→</span>
              </>
            ) : locationStatus === "requesting" ? (
              <>
                <span
                  className="animate-spin"
                  style={{
                    display: "inline-block",
                    width: "18px",
                    height: "18px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                  }}
                />
                <span>Verifying Your Location...</span>
              </>
            ) : (
              <>
                <span>📍</span>
                <span>Allow Location & Enter Menu</span>
                <span style={{ fontSize: "1.2rem" }}>→</span>
              </>
            )}
          </button>

          {locationStatus !== "verified" && (
            <button
              onClick={() => router.push("/menu")}
              className="tap-scale"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                cursor: "pointer",
                padding: "6px 0",
                textDecoration: "underline",
                textAlign: "center",
              }}
            >
              Browse menu in view-only mode →
            </button>
          )}

          {autoRedirectCountdown !== null && autoRedirectCountdown > 0 && locationStatus === "verified" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
              }}
            >
              <span
                className="animate-spin"
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  border: "2px solid rgba(255,255,255,0.2)",
                  borderTopColor: "var(--accent)",
                  borderRadius: "50%",
                }}
              />
              <span>Opening menu automatically in {autoRedirectCountdown}s...</span>
            </div>
          )}
        </div>

        {/* ─── Dedicated Location Request Card ─────────────────────────────── */}
        <div
          className="glass animate-fade-in-up"
          style={{
            animationDelay: "0.22s",
            width: "100%",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            border:
              locationStatus === "verified"
                ? "1px solid rgba(34,197,94,0.3)"
                : locationStatus === "out_of_range" || locationStatus === "denied"
                ? "1px solid rgba(239,68,68,0.35)"
                : "1px solid var(--border)",
            background:
              locationStatus === "verified"
                ? "rgba(34,197,94,0.04)"
                : locationStatus === "denied"
                ? "rgba(239,68,68,0.04)"
                : "var(--bg-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background:
                  locationStatus === "verified"
                    ? "rgba(34,197,94,0.15)"
                    : locationStatus === "denied" || locationStatus === "out_of_range"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(255,107,43,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              {locationStatus === "verified" ? "📍" : locationStatus === "requesting" ? "⏳" : "🧭"}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "3px" }}>
                {locationStatus === "verified"
                  ? "Table Location Verified"
                  : locationStatus === "requesting"
                  ? "Locating Your Table..."
                  : locationStatus === "out_of_range"
                  ? "Outside Dining Range"
                  : locationStatus === "denied"
                  ? "Location Access Needed"
                  : "Verify Your Location"}
              </h2>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                {locationStatus === "verified"
                  ? `Your device is confirmed at ${tableInfo?.branchName} (${tableInfo?.distanceMeters != null ? `~${tableInfo.distanceMeters}m from counter` : "within range"}). You can place dine-in orders.`
                  : locationStatus === "requesting"
                  ? "Accessing GPS to verify you are seated at this table..."
                  : locationStatus === "out_of_range"
                  ? locationError || "You appear to be outside the restaurant. Dine-in orders are restricted to customers on-site."
                  : locationStatus === "denied"
                  ? locationError || "Location access was denied. Please allow location permissions in your browser to verify your table."
                  : `Please share your current location to verify you're dining at Table ${tableInfo?.tableNumber} and unlock ordering.`}
              </p>
            </div>
          </div>

          {/* Action button for location */}
          {locationStatus !== "verified" ? (
            <>
            <button
              onClick={handleRequestLocation}
              disabled={locationStatus === "requesting"}
              className="btn-accent"
              style={{
                width: "100%",
                padding: "13px 16px",
                fontSize: "0.9rem",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: locationStatus === "requesting" ? "wait" : "pointer",
                background:
                  locationStatus === "denied" || locationStatus === "out_of_range"
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : undefined,
              }}
            >
              {locationStatus === "requesting" ? (
                <>
                  <span
                    className="animate-spin"
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                    }}
                  />
                  <span>Accessing GPS...</span>
                </>
              ) : locationStatus === "denied" ? (
                <>
                  <span>🔄</span>
                  <span>Try Again & Allow Location</span>
                </>
              ) : locationStatus === "out_of_range" ? (
                <>
                  <span>📡</span>
                  <span>Re-check My Location</span>
                </>
              ) : (
                <>
                  <span>📍</span>
                  <span>Share Location to Verify</span>
                </>
              )}
            </button>
            {(locationStatus === "denied" || locationStatus === "out_of_range" || locationStatus === "error") && (
              <button
                type="button"
                onClick={() => {
                  setLocationStatus("verified");
                  setLocationError("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  textDecoration: "underline",
                  cursor: "pointer",
                  marginTop: "8px",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Skip location verification (Testing Mode)
              </button>
            )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.78rem",
                color: "#22c55e",
                background: "rgba(34,197,94,0.1)",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              <span>✓</span>
              <span>Dine-in verified. Ready to browse and order.</span>
              <button
                onClick={handleRequestLocation}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  textDecoration: "underline",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Info rows */}
        <div
          className="animate-fade-in-up"
          style={{
            animationDelay: "0.28s",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {[
            { icon: "📍", label: "Branch", value: tableInfo?.branchName },
            { icon: "🛒", label: "Order type", value: "Dine-in" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "16px" }}>{row.icon}</span>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  flex: 1,
                }}
              >
                {row.label}
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Popular & Featured Dishes on Home Page */}
        {items.length > 0 && (
          <div
            className="animate-fade-in-up"
            style={{
              animationDelay: "0.32s",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                  }}
                >
                  <Sparkles size={14} />
                </span>
                <div>
                  <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Featured Dishes</h2>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    Tap any item to explore pairings
                  </span>
                </div>
              </div>
              <button
                onClick={() => router.push("/menu")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Full Menu</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                background: "var(--bg-card)",
                borderRadius: "20px",
                border: "1px solid var(--border)",
                overflow: "hidden",
                padding: "4px 16px",
              }}
            >
              {items.slice(0, 6).map((item, idx) => {
                const isPairingOpen = pairingItem?.id === item.id;
                return (
                  <React.Fragment key={item.id}>
                    {idx > 0 && (
                      <div
                        style={{
                          height: "1px",
                          background: "var(--border)",
                          margin: "0",
                          opacity: 0.5,
                        }}
                      />
                    )}
                    <div style={{ position: "relative" }}>
                      <MenuCard
                        item={item}
                        qty={getQty(item.id)}
                        onAdd={() => {
                          addItem(item);
                          setPairingItem(item);
                        }}
                        onRemove={() => removeItem(item.id)}
                        onOpenSheet={() => router.push("/menu")}
                        onCardClick={() => router.push("/menu")}
                        isSelected={isPairingOpen}
                        delay={idx * 0.04}
                      />
                      {isPairingOpen && (
                        <div style={{ margin: "2px 0 12px" }}>
                          <InlinePairingStrip
                            triggerItem={pairingItem}
                            allItems={items}
                            cartItemIds={cart.map((c) => c.item.id)}
                            onAdd={(p: MenuItem) => {
                              addItem(p);
                            }}
                            onDismiss={() => setPairingItem(null)}
                          />
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Liquid Glass Dock (Menu & Cart Quick View) */}
        <div
          className="animate-fade-in-up"
          style={{
            position: "fixed",
            bottom: "calc(max(16px, env(safe-area-inset-bottom, 16px)))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 28px)",
            maxWidth: "460px",
            zIndex: 99,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {/* Menu Button - Liquid Glass Pill */}
          <button
            onClick={() => setShowMenuPopup((v) => !v)}
            className="tap-scale"
            style={{
              padding: "13px 18px",
              borderRadius: "18px",
              background: showMenuPopup
                ? "var(--accent)"
                : "var(--liquid-glass-bg)",
              backdropFilter: "blur(28px) saturate(190%)",
              WebkitBackdropFilter: "blur(28px) saturate(190%)",
              border: `1.5px solid ${showMenuPopup ? "var(--accent)" : "var(--liquid-glass-border)"}`,
              boxShadow: "var(--liquid-glass-shadow)",
              color: showMenuPopup ? "#ffffff" : "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <span>{showMenuPopup ? "✕ Close" : "Menu"}</span>
          </button>

          {/* Cart Button - Liquid Glass Morphism with Quick View */}
          <button
            onClick={() => {
              if (totalItems > 0) {
                setShowCartQuickView(true);
              } else {
                router.push("/menu");
              }
            }}
            className="tap-scale"
            style={{
              flex: 1,
              padding: "13px 18px",
              borderRadius: "18px",
              background: totalItems > 0
                ? "linear-gradient(135deg, var(--accent) 0%, #ea580c 100%)"
                : "var(--liquid-glass-bg)",
              backdropFilter: "blur(28px) saturate(190%)",
              WebkitBackdropFilter: "blur(28px) saturate(190%)",
              border: totalItems > 0
                ? "1px solid rgba(255, 255, 255, 0.25)"
                : "1.5px solid var(--liquid-glass-border)",
              boxShadow: totalItems > 0
                ? "0 12px 32px rgba(255, 87, 34, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)"
                : "var(--liquid-glass-shadow)",
              color: totalItems > 0 ? "#ffffff" : "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontWeight: 800,
              fontSize: "0.92rem",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ShoppingBag size={18} />
              <span>
                {totalItems > 0
                  ? `${totalItems} item${totalItems > 1 ? "s" : ""}`
                  : "Explore Menu"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {totalItems > 0 ? (
                <>
                  <span>₹{totalPrice}</span>
                  <span style={{ fontSize: "0.75rem", opacity: 0.85, background: "rgba(255,255,255,0.2)", padding: "2px 7px", borderRadius: "10px" }}>
                    Quick View
                  </span>
                </>
              ) : (
                <span style={{ fontSize: "1.1rem" }}>→</span>
              )}
            </div>
          </button>
        </div>

        {/* Clean Menu Categories Popover (Name & Count, NO icons) */}
        {showMenuPopup && (
          <>
            <div
              onClick={() => setShowMenuPopup(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 97,
                background: "rgba(0, 0, 0, 0.35)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            />
            <div
              className="anim-pop"
              style={{
                position: "fixed",
                bottom: "calc(max(16px, env(safe-area-inset-bottom, 16px)) + 62px)",
                left: "14px",
                width: "270px",
                maxHeight: "360px",
                zIndex: 98,
                background: "var(--bg-card)",
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                border: "1px solid var(--border)",
                borderRadius: "20px",
                boxShadow: "var(--card-shadow)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "13px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Menu Categories
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--accent)",
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontWeight: 700,
                  }}
                >
                  {categories.length}
                </span>
              </div>
              <div
                className="hide-scrollbar"
                style={{
                  overflowY: "auto",
                  padding: "8px 10px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setShowMenuPopup(false);
                      router.push(`/menu?cat=${cat.id}`);
                    }}
                    className="tap-scale"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      border: "1px solid transparent",
                      background: "var(--tag-bg)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cat.name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "var(--border)",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                        marginLeft: "8px",
                      }}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Liquid Glass Cart Quick View Sheet */}
        {showCartQuickView && (
          <>
            <div
              onClick={() => setShowCartQuickView(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                background: "rgba(0, 0, 0, 0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            />
            <div
              className="anim-slide-up"
              style={{
                position: "fixed",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "100%",
                maxWidth: "520px",
                maxHeight: "82dvh",
                zIndex: 101,
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--liquid-glass-border)",
                borderRadius: "28px 28px 0 0",
                boxShadow: "0 -20px 50px rgba(0, 0, 0, 0.35)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>
                    Table Cart
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {totalItems} item{totalItems > 1 ? "s" : ""} selected for Table {tableInfo?.tableNumber}
                  </span>
                </div>
                <button
                  onClick={() => setShowCartQuickView(false)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "var(--tag-bg)",
                    border: "none",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Items List */}
              <div
                className="hide-scrollbar"
                style={{
                  overflowY: "auto",
                  padding: "14px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  flex: 1,
                }}
              >
                {cart.map((cartItem) => {
                  const price = Number(cartItem.item.dineInPrice ?? cartItem.item.discountedPrice ?? cartItem.item.price) || 0;
                  const itemSubtotal = price * cartItem.quantity;

                  return (
                    <div
                      key={cartItem.item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        gap: "12px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {cartItem.item.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          ₹{price} each
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          background: "var(--accent-bg)",
                          border: "1px solid var(--accent-border)",
                          borderRadius: "10px",
                          padding: "4px 8px",
                        }}
                      >
                        <button
                          onClick={() => removeItem(cartItem.item.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px",
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, minWidth: "16px", textAlign: "center", color: "var(--accent)" }}>
                          {cartItem.quantity}
                        </span>
                        <button
                          onClick={() => addItem(cartItem.item)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px",
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div style={{ fontSize: "0.92rem", fontWeight: 800, minWidth: "55px", textAlign: "right", color: "var(--text-primary)" }}>
                        ₹{itemSubtotal}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Footer & CTAs */}
              <div
                style={{
                  padding: "16px 20px calc(max(16px, env(safe-area-inset-bottom, 16px)))",
                  borderTop: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Cart Total</span>
                  <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--text-primary)" }}>
                    ₹{totalPrice}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowCartQuickView(false);
                    router.push("/checkout");
                  }}
                  className="btn-accent tap-scale"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "14px",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 8px 24px var(--accent-glow)",
                    cursor: "pointer",
                  }}
                >
                  <span>Proceed to Checkout</span>
                  <span>→</span>
                </button>

                <button
                  onClick={() => setShowCartQuickView(false)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add more dishes
                </button>
              </div>
            </div>
          </>
        )}

        <p
          className="animate-fade-in-up"
          style={{
            animationDelay: "0.4s",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            textAlign: "center",
            paddingBottom: "80px",
          }}
        >
          {locationStatus === "verified"
            ? "Your table is verified • Sign in during checkout to complete order"
            : "Location is required to submit your dine-in order"}
        </p>
      </div>
    </main>
  );
}

function LoadingScreen() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const phrases = [
    "Connecting to your table...",
    "Curating fresh kitchen menu...",
    "Preparing your digital dining...",
  ];

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "radial-gradient(ellipse at center, rgba(255, 87, 34, 0.08) 0%, var(--bg-primary) 70%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient pulsating glow */}
      <div
        style={{
          position: "absolute",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
          animation: "loaderGlowPulse 3s infinite ease-in-out",
        }}
      />

      {/* Center Animated Disc & Orbital Rings */}
      <div style={{ position: "relative", width: "110px", height: "110px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Outer orbital dash ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px dashed var(--accent-border)",
            animation: "loaderSpinClockwise 9s linear infinite",
          }}
        />

        {/* Counter-rotating glowing accent arc */}
        <div
          style={{
            position: "absolute",
            inset: "-4px",
            borderRadius: "50%",
            border: "2.5px solid transparent",
            borderTopColor: "var(--accent)",
            borderRightColor: "var(--accent-2)",
            animation: "loaderSpinCounter 1.8s cubic-bezier(0.5, 0, 0.5, 1) infinite",
            filter: "drop-shadow(0 0 8px var(--accent-glow))",
          }}
        />

        {/* Inner liquid glass badge */}
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "22px",
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.04) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 14px 28px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "loaderBadgeFloat 2.5s ease-in-out infinite",
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M4 10a8 8 0 0 1 16 0v2H4z" />
            <path d="M2 14h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
            <path d="M12 2v2" />
          </svg>
        </div>
      </div>

      {/* Shimmering Dynamic Text */}
      <div style={{ marginTop: "28px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <p
          key={phase}
          className="anim-pop"
          style={{
            color: "var(--text-primary)",
            fontSize: "1.02rem",
            fontWeight: 700,
            letterSpacing: "0.01em",
            margin: 0,
          }}
        >
          {phrases[phase]}
        </p>

        {/* Liquid progress bar */}
        <div
          style={{
            width: "120px",
            height: "4px",
            borderRadius: "4px",
            background: "rgba(255, 255, 255, 0.08)",
            overflow: "hidden",
            position: "relative",
            marginTop: "4px",
          }}
        >
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: "45%",
              background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
              borderRadius: "4px",
              animation: "loaderShimmerLine 1.4s infinite ease-in-out",
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes loaderSpinClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loaderSpinCounter {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes loaderBadgeFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.04); }
        }
        @keyframes loaderGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 0.85; transform: scale(1.15); }
        }
        @keyframes loaderShimmerLine {
          0% { left: -45%; }
          100% { left: 100%; }
        }
      `}</style>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        gap: "20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "56px" }}>❌</div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Something went wrong</h1>
      <p
        style={{
          color: "var(--text-secondary)",
          maxWidth: "320px",
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        Please ask a staff member for help.
      </p>
    </main>
  );
}
