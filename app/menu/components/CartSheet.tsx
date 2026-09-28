"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, storage, MenuItem, CartItem, PaymentMethod } from "@/lib/api";
import BottomSheet from "@/lib/BottomSheet";
import { getPairingItems } from "./menuUtils";
import { Sparkles, Plus, Minus, Flame, Check } from "lucide-react";

export interface CartSheetProps {
  cart: CartItem[];
  totalItems: number;
  totalPrice: number;
  tableInfo: NonNullable<ReturnType<typeof storage.getTableInfo>>;
  user: { fullName: string } | null;
  setUser: (user: any) => void;
  onClose: () => void;
  onAdd: (item: MenuItem, portion?: string, instructions?: string, addOnIds?: string[]) => void;
  onRemove: (id: string, portion?: string, addOnIds?: string[]) => void;
  setCart: (c: CartItem[]) => void;
  showToast: (msg: string, type?: string) => void;
  allItems?: MenuItem[];
}

export function CartSheet({
  cart,
  totalItems,
  totalPrice,
  tableInfo,
  user,
  setUser,
  onClose,
  onAdd,
  onRemove,
  setCart,
  showToast,
  allItems = [],
}: CartSheetProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Quick Auth inline state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "otp">("phone");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authOtp, setAuthOtp] = useState(["", "", "", "", "", ""]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authCountdown, setAuthCountdown] = useState(0);
  const authCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Inline Location Modal state if coordinates are missing
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationModalError, setLocationModalError] = useState("");

  // Terms and conditions acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleRequestLocationInDrawer = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationModalError("Geolocation is not supported by your browser.");
      return;
    }

    setLocationLoading(true);
    setLocationModalError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        sessionStorage.setItem("userLat", String(lat));
        sessionStorage.setItem("userLng", String(lng));
        setLocationLoading(false);
        setShowLocationModal(false);
        await executeOrderPlacement(lat, lng);
      },
      (err) => {
        setLocationLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationModalError(
            "Location access was denied. Please allow location permissions in your browser settings to place dine-in orders."
          );
        } else {
          setLocationModalError(
            "Could not retrieve GPS location. Please ensure location services are enabled on your device."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const tax = totalPrice * 0.05;
  const grandTotal = totalPrice + tax;

  const startCountdown = (secs = 60) => {
    setAuthCountdown(secs);
    if (authCountdownRef.current) clearInterval(authCountdownRef.current);
    authCountdownRef.current = setInterval(() => {
      setAuthCountdown((c) => {
        if (c <= 1) {
          clearInterval(authCountdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const raw = authPhone.replace(/\D/g, "");
    if (raw.length < 10) {
      setAuthError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    try {
      await api.auth.sendOtp(`+91${raw.slice(-10)}`);
      setAuthStep("otp");
      startCountdown(60);
      setTimeout(() => authOtpRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      setAuthError(e.message ?? "Failed to send OTP. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpValue = code ?? authOtp.join("");
    if (otpValue.length !== 6) {
      setAuthError("Please enter the complete 6-digit code.");
      return;
    }
    const raw = authPhone.replace(/\D/g, "");
    setAuthError("");
    setAuthLoading(true);
    try {
      const data = await api.auth.verifyOtp({
        phone: `+91${raw.slice(-10)}`,
        code: otpValue,
        fullName: authName.trim() || undefined,
      });
      storage.setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      setUser(data.user);
      setShowAuthModal(false);
      showToast("Verified successfully!", "success");

      // Check if location is already present before completing order placement
      const lat = parseFloat(sessionStorage.getItem("userLat") ?? "");
      const lng = parseFloat(sessionStorage.getItem("userLng") ?? "");
      if (isNaN(lat) || isNaN(lng)) {
        setShowLocationModal(true);
      } else {
        await executeOrderPlacement(lat, lng);
      }
    } catch (e: any) {
      setAuthError(e.message ?? "Invalid verification code.");
    } finally {
      setAuthLoading(false);
    }
  };

  const executeOrderPlacement = async (explicitLat?: number, explicitLng?: number) => {
    setError("");
    setLoading(true);
    try {
      let lat: number | undefined =
        explicitLat ?? (parseFloat(sessionStorage.getItem("userLat") ?? "") || undefined);
      let lng: number | undefined =
        explicitLng ?? (parseFloat(sessionStorage.getItem("userLng") ?? "") || undefined);

      if (lat == null || lng == null) {
        setLoading(false);
        setShowLocationModal(true);
        return;
      }

      const token =
        sessionStorage.getItem("qrToken") ||
        localStorage.getItem("qrToken") ||
        tableInfo?.qrToken ||
        undefined;

      const order = await api.orders.create({
        restaurantId: tableInfo.restaurantId,
        orderType: "dine_in",
        tableToken: token,
        dineInBranchId: tableInfo.branchId || undefined,
        tableNumber: tableInfo.tableNumber || undefined,
        latitude: lat,
        longitude: lng,
        items: cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          portion: c.portion,
          specialInstructions: c.specialInstructions,
          addOnIds: c.addOnIds,
        })),
        notes: notes || undefined,
        paymentMethod,
      });
      setCart([]);
      if (paymentMethod === "online") {
        router.push(`/payment?orderId=${order.id}`);
      } else {
        router.push(`/orders/${order.id}`);
      }
    } catch (e: any) {
      const msg: string = e.message ?? "Failed to place order.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("jwt") ||
        lower.includes("expire") ||
        lower.includes("unauthorized")
      ) {
        storage.clearAuth();
        setUser(null);
        setShowAuthModal(true);
        setError("");
        showToast(
          "Your session expired. Please verify your phone number to complete your order.",
          "error"
        );
      } else {
        setError(msg);
        showToast(msg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async () => {
    if (!acceptedTerms) {
      setError("Please accept the Terms & Conditions before placing your order.");
      showToast("Please accept the Terms & Conditions to place order.", "error");
      return;
    }

    const auth = storage.getAuth();
    if (!auth) {
      setShowAuthModal(true);
      return;
    }

    const lat = parseFloat(sessionStorage.getItem("userLat") ?? "");
    const lng = parseFloat(sessionStorage.getItem("userLng") ?? "");
    if (isNaN(lat) || isNaN(lng)) {
      setShowLocationModal(true);
      return;
    }

    await executeOrderPlacement(lat, lng);
  };

  return (
    <BottomSheet
      isOpen={true}
      onClose={onClose}
      title="Your Cart"
      subtitle={`🪑 Table ${tableInfo.tableNumber} · ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
      zIndex={70}
    >
      {/* Scrollable items */}
      <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {cart.map((c) => {
            const price = c.unitPrice ?? (c.item.dineInPrice ?? c.item.discountedPrice ?? c.item.price);
            const selectedAddOns = (c.item.addOns ?? []).filter((addon) => c.addOnIds?.includes(addon.id));
            return (
              <div
                key={`${c.item.id}-${c.portion}-${(c.addOnIds ?? []).join("-")}`}
                className="anim-fade-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: "2px",
                    }}
                  >
                    {c.item.name}
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", lineHeight: 1.4 }}>
                    {c.portion || "Full"}{selectedAddOns.length ? ` · ${selectedAddOns.map((addon) => addon.name).join(", ")}` : ""} · ₹{price} each
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(255,107,43,0.1)",
                    border: "1px solid var(--border-active)",
                    borderRadius: "10px",
                    padding: "3px",
                    flexShrink: 0,
                  }}
                >
                  <button
                    className="qty-btn tap-scale"
                    onClick={() => onRemove(c.item.id, c.portion, c.addOnIds)}
                    style={{
                      border: "none",
                      width: "30px",
                      height: "30px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label={`Remove one ${c.item.name}`}
                  >
                    <Minus size={13} strokeWidth={2.6} />
                  </button>
                  <span style={{ fontWeight: 700, minWidth: "20px", textAlign: "center", color: "var(--accent)", fontSize: "0.95rem" }}>
                    {c.quantity}
                  </span>
                  <button
                    className="qty-btn tap-scale"
                    onClick={() => onAdd(c.item, c.portion, c.specialInstructions, c.addOnIds)}
                    style={{
                      border: "none",
                      width: "30px",
                      height: "30px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label={`Add one ${c.item.name}`}
                  >
                    <Plus size={13} strokeWidth={2.6} />
                  </button>
                </div>
                <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem", minWidth: "52px", textAlign: "right", flexShrink: 0 }}>
                  ₹{(price * c.quantity).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Recommended Add-ons Section */}
        {(() => {
          const lastItem = cart[cart.length - 1]?.item;
          const cartPairings = lastItem && allItems.length > 0
            ? getPairingItems(
                lastItem,
                allItems,
                cart.map((c) => c.item.id)
              ).slice(0, 6)
            : [];

          if (cartPairings.length === 0) return null;

          return (
            <div
              className="apple-glass"
              style={{
                marginTop: "16px",
                padding: "14px",
                borderRadius: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--accent-bg)",
                      border: "1px solid var(--accent-border)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                      boxShadow: "0 0 10px var(--accent-glow)",
                    }}
                  >
                    <Sparkles size={12} strokeWidth={2.5} />
                  </span>
                  <span
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                    }}
                  >
                    Add a quick bite / drink?
                  </span>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "var(--accent-bg)",
                    padding: "2px 8px",
                    borderRadius: "100px",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  <Flame size={10} strokeWidth={2.5} /> Recommended
                </span>
              </div>

              <div
                className="hide-scrollbar scroll-touch"
                style={{
                  display: "flex",
                  gap: "10px",
                  overflowX: "auto",
                  paddingBottom: "4px",
                }}
              >
                {cartPairings.map((p) => {
                  const pPrice = p.dineInPrice ?? p.discountedPrice ?? p.price;
                  return (
                    <div
                      key={p.id}
                      className="tap-scale"
                      style={{
                        width: "132px",
                        flexShrink: 0,
                        background: "var(--apple-glass-card)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        borderRadius: "14px",
                        border: "1px solid var(--apple-glass-border)",
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        boxShadow: "var(--apple-glass-shadow)",
                      }}
                    >
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              background: "var(--accent-bg)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "18px",
                              flexShrink: 0,
                            }}
                          >
                            {p.isVeg ? "🥦" : "🍖"}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              lineHeight: 1.2,
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              color: "var(--text-primary)",
                            }}
                          >
                            {p.name}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent)" }}>
                          ₹{pPrice}
                        </span>
                        <button
                          onClick={() => {
                            onAdd(p);
                            showToast(`${p.name} added!`, "success");
                          }}
                          className="tap-scale"
                          aria-label={`Add ${p.name}`}
                          style={{
                            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 2px 8px var(--accent-glow)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Plus size={11} strokeWidth={2.8} /> Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Notes */}
        <div style={{ marginTop: "16px" }}>
          <label
            style={{
              display: "block",
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              fontWeight: 600,
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Special Instructions
          </label>
          <textarea
            className="input-field"
            placeholder="Allergies, preferences, extra spice..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ padding: "12px 14px", fontSize: "0.9rem", resize: "none" }}
            aria-label="Special instructions"
          />
        </div>

        {/* Payment Method Selection */}
        <div style={{ marginTop: "16px" }}>
          <label
            style={{
              display: "block",
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              fontWeight: 600,
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Payment Method
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              type="button"
              className="tap-scale"
              onClick={() => setPaymentMethod("online")}
              style={{
                padding: "12px",
                borderRadius: "14px",
                border: `1.5px solid ${paymentMethod === "online" ? "var(--accent)" : "var(--border)"}`,
                background: paymentMethod === "online" ? "rgba(255,107,43,0.12)" : "rgba(255,255,255,0.03)",
                color: paymentMethod === "online" ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "18px" }}>💳</span>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    border: `2px solid ${paymentMethod === "online" ? "var(--accent)" : "var(--text-muted)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {paymentMethod === "online" && (
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)" }} />
                  )}
                </span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: paymentMethod === "online" ? "var(--accent)" : "inherit" }}>
                Pay Online
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                UPI, Cards, Netbanking
              </span>
            </button>

            <button
              type="button"
              className="tap-scale"
              onClick={() => setPaymentMethod("cod")}
              style={{
                padding: "12px",
                borderRadius: "14px",
                border: `1.5px solid ${paymentMethod === "cod" ? "var(--accent)" : "var(--border)"}`,
                background: paymentMethod === "cod" ? "rgba(255,107,43,0.12)" : "rgba(255,255,255,0.03)",
                color: paymentMethod === "cod" ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "18px" }}>💵</span>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    border: `2px solid ${paymentMethod === "cod" ? "var(--accent)" : "var(--text-muted)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {paymentMethod === "cod" && (
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)" }} />
                  )}
                </span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: paymentMethod === "cod" ? "var(--accent)" : "inherit" }}>
                Pay at Counter
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                Cash after dining
              </span>
            </button>
          </div>
        </div>

        {/* Bill Summary */}
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "4px",
            }}
          >
            Bill Summary
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>Subtotal</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>₹{totalPrice.toFixed(0)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>GST (5%)</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>₹{tax.toFixed(0)}</span>
          </div>

          <div style={{ height: "1px", background: "var(--border)", margin: "2px 0" }} />

          {/* Grand total — prominent highlight */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              background: "rgba(255,107,43,0.08)",
              borderRadius: "12px",
              border: "1px solid rgba(255,107,43,0.2)",
            }}
          >
            <div>
              <p style={{ fontWeight: 800, fontSize: "1rem" }}>Total to Pay</p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>incl. all taxes</p>
            </div>
            <span
              style={{
                fontWeight: 900,
                color: "var(--accent)",
                fontSize: "1.6rem",
                letterSpacing: "-0.02em",
              }}
            >
              ₹{grandTotal.toFixed(0)}
            </span>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", textAlign: "center" }}>
            {paymentMethod === "online"
              ? "🔒 Secured by Razorpay · UPI / Cards / Netbanking"
              : "💵 Pay at counter · Cash accepted"}
          </p>
        </div>

        {error && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#ef4444",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Place Order sticky footer */}
      <div
        style={{
          padding: "14px 20px max(14px, env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-card)",
          flexShrink: 0,
        }}
      >
        {/* Terms & Conditions Acceptance */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "12px",
            background: acceptedTerms ? "rgba(34, 197, 94, 0.05)" : "rgba(255, 255, 255, 0.03)",
            border: acceptedTerms ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid var(--border)",
            marginBottom: "12px",
            cursor: "pointer",
            fontSize: "0.75rem",
            lineHeight: 1.4,
            color: "var(--text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            style={{
              marginTop: "2px",
              width: "16px",
              height: "16px",
              accentColor: "var(--accent)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <span>
            I accept the <strong style={{ color: "var(--text-primary)" }}>Terms & Conditions</strong>. We are a service and technology provider and do not own, prepare, or guarantee the food quality or preparation.
          </span>
        </label>

        <button
          className="btn-accent tap-scale"
          id="place-order-btn"
          style={{
            width: "100%",
            padding: "0",
            fontSize: "1rem",
            borderRadius: "16px",
            display: "flex",
            alignItems: "stretch",
            overflow: "hidden",
            boxShadow: acceptedTerms ? "0 6px 24px rgba(255,107,43,0.4)" : "none",
            opacity: acceptedTerms ? 1 : 0.6,
            cursor: acceptedTerms ? "pointer" : "not-allowed",
          }}
          onClick={placeOrder}
          disabled={loading || !acceptedTerms}
          aria-label={`Place order — ₹${grandTotal.toFixed(0)}`}
        >
          {loading ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                padding: "18px",
              }}
            >
              <span className="spinner" />
            </span>
          ) : (
            <>
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "18px 16px",
                  fontWeight: 700,
                  fontSize: "1rem",
                }}
              >
                {paymentMethod === "online" ? "💳 Place Order & Pay" : "🍽️ Place Order"}
              </span>
              <span
                style={{
                  background: "rgba(0,0,0,0.2)",
                  padding: "18px 22px",
                  fontWeight: 900,
                  fontSize: "1.15rem",
                  display: "flex",
                  alignItems: "center",
                  borderLeft: "1px solid rgba(255,255,255,0.15)",
                  letterSpacing: "-0.01em",
                }}
              >
                ₹{grandTotal.toFixed(0)}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Inline Quick Auth Modal for Guest Users */}
      {showAuthModal && (
        <div
          className="anim-fade-up"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(10,10,15,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="anim-pop"
            style={{
              width: "100%",
              maxWidth: "400px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "24px",
              padding: "24px 20px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowAuthModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
              }}
              aria-label="Close verification"
            >
              ✕
            </button>

            {authStep === "phone" ? (
              <div>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "16px",
                    background: "rgba(255,107,43,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    marginBottom: "16px",
                  }}
                >
                  📱
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "4px" }}>
                  Confirm Your Order
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "20px", lineHeight: 1.4 }}>
                  Enter your mobile number to receive your order status and updates.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>
                      Your Name (Optional)
                    </label>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      style={{ padding: "12px 14px", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>
                      Mobile Number
                    </label>
                    <div style={{ position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: "14px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                          fontSize: "0.95rem",
                          fontWeight: 600,
                        }}
                      >
                        +91
                      </span>
                      <input
                        className="input-field"
                        type="tel"
                        maxLength={10}
                        placeholder="98765 43210"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ""))}
                        style={{ padding: "12px 14px 12px 50px", fontSize: "0.95rem" }}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                {authError && (
                  <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "14px", textAlign: "center" }}>
                    {authError}
                  </p>
                )}

                <button
                  className="btn-accent tap-scale"
                  onClick={handleSendOtp}
                  disabled={authLoading || authPhone.length < 10}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "14px",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {authLoading ? (
                    <span className="spinner" style={{ width: "20px", height: "20px" }} />
                  ) : (
                    "Send Verification Code →"
                  )}
                </button>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "16px",
                    background: "rgba(34,197,94,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    marginBottom: "16px",
                  }}
                >
                  🔐
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "4px" }}>
                  Verify Code
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "20px", lineHeight: 1.4 }}>
                  Sent 6-digit code to <strong style={{ color: "var(--text-primary)" }}>+91 {authPhone}</strong>{" "}
                  <button
                    onClick={() => { setAuthStep("phone"); setAuthError(""); }}
                    style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.8rem", textDecoration: "underline" }}
                  >
                    Edit
                  </button>
                </p>

                {/* 6-box OTP inputs */}
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "20px" }}>
                  {authOtp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { authOtpRefs.current[idx] = el; }}
                      className="input-field"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(-1);
                        const next = [...authOtp];
                        next[idx] = val;
                        setAuthOtp(next);
                        if (val && idx < 5) {
                          authOtpRefs.current[idx + 1]?.focus();
                        }
                        if (val && idx === 5 && next.every((d) => d)) {
                          handleVerifyOtp(next.join(""));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !authOtp[idx] && idx > 0) {
                          authOtpRefs.current[idx - 1]?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        if (pasted.length === 6) {
                          setAuthOtp(pasted.split(""));
                          handleVerifyOtp(pasted);
                        }
                      }}
                      style={{
                        width: "44px",
                        height: "52px",
                        textAlign: "center",
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        padding: 0,
                        borderRadius: "12px",
                        border: digit ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                      }}
                    />
                  ))}
                </div>

                {authError && (
                  <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "14px", textAlign: "center" }}>
                    {authError}
                  </p>
                )}

                <button
                  className="btn-accent tap-scale"
                  onClick={() => handleVerifyOtp()}
                  disabled={authLoading || authOtp.some((d) => !d)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "14px",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginBottom: "14px",
                  }}
                >
                  {authLoading ? (
                    <span className="spinner" style={{ width: "20px", height: "20px" }} />
                  ) : (
                    "Verify & Place Order"
                  )}
                </button>

                <div style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {authCountdown > 0 ? (
                    <span>Resend code in {authCountdown}s</span>
                  ) : (
                    <button
                      onClick={handleSendOtp}
                      style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Location Modal for Dine-In Checkout */}
      {showLocationModal && (
        <div
          className="anim-fade-up"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 85,
            background: "rgba(10,10,15,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="anim-pop"
            style={{
              width: "100%",
              maxWidth: "390px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "24px",
              padding: "24px 20px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              position: "relative",
              textAlign: "center",
            }}
          >
            <button
              onClick={() => setShowLocationModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close"
            >
              ✕
            </button>

            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "20px",
                background: "rgba(255,107,43,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                margin: "0 auto 16px auto",
              }}
            >
              📍
            </div>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px" }}>
              Location Required
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                marginBottom: "20px",
                lineHeight: 1.5,
              }}
            >
              To confirm you are seated at Table {tableInfo.tableNumber} in {tableInfo.branchName}, please share your location.
            </p>

            {locationModalError && (
              <div
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                {locationModalError}
              </div>
            )}

            <button
              className="btn-accent tap-scale"
              onClick={handleRequestLocationInDrawer}
              disabled={locationLoading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                fontWeight: 700,
                fontSize: "0.95rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {locationLoading ? (
                <>
                  <span className="spinner" style={{ width: "20px", height: "20px" }} />
                  <span>Verifying Location...</span>
                </>
              ) : (
                <>
                  <span>📍</span>
                  <span>Allow Location & Confirm Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
