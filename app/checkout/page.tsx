"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, storage, CartItem, PaymentMethod, TableInfo, Order } from "@/lib/api";
import { processRazorpayPayment, PaymentCancelledError } from "@/lib/razorpay";

export default function CheckoutPage() {
  const router = useRouter();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [user, setUser] = useState<{ id?: string; fullName: string; phone: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");
  const [loading, setLoading] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // Digital Bill / Phone contact state
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  // Pending order if payment was cancelled
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);

  // Location state
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "verified" | "error">("idle");
  const [locationError, setLocationError] = useState("");

  // Terms and conditions acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const showToast = (msg: string, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // 1. Load cart
    const currentCart = storage.getCart();
    setCart(currentCart);

    // 2. Load table info
    let currentTable = storage.getTableInfo();
    if (!currentTable) {
      currentTable = {
        tableId: "e3046ca3-dfc8-47cb-b047-a54d8b9ed0b9",
        tableNumber: "T1",
        branchId: "ac3454c5-03f2-4015-b6ef-2e80aa3b9bc2",
        branchName: "Koramangala",
        restaurantId: "68e85e16-9389-4628-a0ef-fdddff815016",
        isWithinRange: true,
        distanceMeters: 15,
        qrToken: sessionStorage.getItem("qrToken") || localStorage.getItem("qrToken") || "2374384b7a6b94d88a87437d0200511b",
      };
      storage.setTableInfo(currentTable);
    }
    setTableInfo(currentTable);

    // 3. Load auth
    const auth = storage.getAuth();
    if (auth?.user) {
      setUser(auth.user);
      setPhone(auth.user.phone.replace(/^\+91/, ""));
      setFullName(auth.user.fullName || "");
    }

    // 4. Check location coordinates
    const lat = sessionStorage.getItem("userLat");
    const lng = sessionStorage.getItem("userLng");
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      setLocationStatus("verified");
    }
  }, []);

  const totalItems = cart.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
  const itemTotal = cart.reduce((sum, c) => {
    const rawPrice = c.item.dineInPrice ?? c.item.discountedPrice ?? c.item.price;
    const priceNum = Number(rawPrice) || 0;
    const qty = Number(c.quantity) || 0;
    return sum + priceNum * qty;
  }, 0);

  // Platform Convenience Fee for Self-Service Dine-In:
  // Menu prices are already GST inclusive.
  // Platform Convenience Fee = 6% + 18% GST on the 6% fee.
  const baseConvenienceFee = Number(((itemTotal * 6) / 100).toFixed(2));
  const gstOnConvenienceFee = Number(((baseConvenienceFee * 18) / 100).toFixed(2));
  const totalConvenienceCharge = Number((baseConvenienceFee + gstOnConvenienceFee).toFixed(2));
  const grandTotal = Number((itemTotal + totalConvenienceCharge).toFixed(2));

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === itemId);
      if (idx < 0) return prev;
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: newQty };
      }
      storage.setCart(next);
      return next;
    });
  };

  // Location handler
  const handleVerifyLocation = (simulate = false) => {
    if (simulate) {
      const lat = 28.489345;
      const lng = 77.093937;
      sessionStorage.setItem("userLat", String(lat));
      sessionStorage.setItem("userLng", String(lng));
      setLocationStatus("verified");
      setLocationError("");
      showToast("Table location verified!", "success");
      return;
    }

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
        sessionStorage.setItem("userLat", String(lat));
        sessionStorage.setItem("userLng", String(lng));
        setLocationStatus("verified");
        setLocationError("");
        showToast("Location verified successfully!", "success");
      },
      (err) => {
        let msg = "Could not retrieve GPS location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied. Tap 'Verify Table (Demo)' to continue.";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS request timed out. Please try again.";
        }
        setLocationStatus("error");
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  // Handle Place Order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      showToast("Your cart is empty!", "error");
      return;
    }

    if (!acceptedTerms) {
      showToast("Please accept the Terms & Conditions before placing your order.", "error");
      return;
    }

    // Validate phone number for bill delivery
    const cleanPhone = phone.replace(/\D/g, "");
    if (!user || isEditingPhone) {
      if (cleanPhone.length < 10) {
        setPhoneError("Please enter a valid 10-digit mobile number for your bill.");
        phoneInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        phoneInputRef.current?.focus();
        showToast("Phone number required to send bill & order updates.", "error");
        return;
      }
    }

    setPhoneError("");
    setError("");
    setLoading(true);
    setPaymentStatusText("Confirming table details...");

    try {
      // 1. Seamless Guest Authentication if not logged in or changing phone
      let activeUser = user;
      if (!activeUser || isEditingPhone) {
        setPaymentStatusText("Setting up bill destination...");
        const authRes = await api.auth.guestLogin({
          phone: cleanPhone,
          fullName: fullName.trim() || undefined,
        });

        storage.setAuth({
          accessToken: authRes.accessToken,
          refreshToken: authRes.refreshToken,
          user: authRes.user,
        });

        activeUser = authRes.user;
        setUser(authRes.user);
        setIsEditingPhone(false);
      }

      // 2. Fallback coordinates for verified dine-in
      let lat = parseFloat(sessionStorage.getItem("userLat") ?? "");
      let lng = parseFloat(sessionStorage.getItem("userLng") ?? "");
      if (isNaN(lat) || isNaN(lng)) {
        lat = 28.489345;
        lng = 77.093937;
        sessionStorage.setItem("userLat", String(lat));
        sessionStorage.setItem("userLng", String(lng));
      }

      // 3. Create the Dine-in Order
      setPaymentStatusText("Placing order with kitchen...");
      const token =
        sessionStorage.getItem("qrToken") ||
        localStorage.getItem("qrToken") ||
        tableInfo?.qrToken ||
        undefined;

      const order = await api.orders.create({
        restaurantId: tableInfo!.restaurantId,
        orderType: "dine_in",
        tableToken: token,
        dineInBranchId: tableInfo?.branchId || undefined,
        tableNumber: tableInfo?.tableNumber || undefined,
        latitude: lat,
        longitude: lng,
        items: cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          portion: c.portion,
          specialInstructions: c.specialInstructions,
          addOnIds: c.addOnIds,
        })),
        notes: notes.trim() || undefined,
        paymentMethod,
      });

      // 4. Handle Payment Flow
      if (paymentMethod === "online") {
        setPaymentStatusText("Opening secure payment gateway...");
        try {
          // Process Razorpay directly in-place without page hopping
          await processRazorpayPayment({
            order: {
              id: order.id,
              restaurantName: tableInfo?.branchName || "Restaurant Dine-In",
              customerName: activeUser.fullName,
              customerPhone: activeUser.phone,
              total: grandTotal,
            },
            user: activeUser,
          });

          // Payment verified successfully
          storage.setCart([]);
          setCart([]);
          showToast("Payment successful! Bill sent to " + activeUser.phone, "success");
          router.push(`/orders/${order.id}`);
        } catch (payErr: any) {
          if (payErr instanceof PaymentCancelledError) {
            setPendingOrder(order);
            setError(
              "Payment window was closed. Order #" +
                order.id.slice(0, 8).toUpperCase() +
                " was registered. You can retry payment below or switch to Pay at Counter."
            );
            showToast("Payment cancelled.", "info");
          } else {
            setPendingOrder(order);
            setError(payErr.message || "Payment verification failed. Please retry or choose Pay at Counter.");
            showToast(payErr.message || "Payment failed", "error");
          }
        }
      } else {
        // Pay at counter / Cash on delivery
        storage.setCart([]);
        setCart([]);
        showToast("Order placed! Bill will be sent to " + activeUser.phone, "success");
        router.push(`/orders/${order.id}`);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to place order. Please try again.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
      setPaymentStatusText("");
    }
  };

  // Retry payment for an existing pending order
  const handleRetryPendingPayment = async () => {
    if (!pendingOrder || !user) return;
    setLoading(true);
    setPaymentStatusText("Reopening payment gateway...");
    setError("");

    try {
      await processRazorpayPayment({
        order: {
          id: pendingOrder.id,
          restaurantName: tableInfo?.branchName || "Restaurant Dine-In",
          customerName: user.fullName,
          customerPhone: user.phone,
          total: grandTotal,
        },
        user,
      });

      storage.setCart([]);
      setCart([]);
      showToast("Payment confirmed! Sent to kitchen.", "success");
      router.push(`/orders/${pendingOrder.id}`);
    } catch (payErr: any) {
      if (payErr instanceof PaymentCancelledError) {
        showToast("Payment cancelled.", "info");
      } else {
        setError(payErr.message || "Payment failed. You can also pay cash at counter.");
        showToast(payErr.message || "Payment failed", "error");
      }
    } finally {
      setLoading(false);
      setPaymentStatusText("");
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        paddingBottom: "130px",
      }}
    >
      {/* ── Top Header ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-header)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => router.push("/menu")}
              className="tap-scale"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--tag-bg)",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "1.1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label="Back to menu"
            >
              ←
            </button>
            <div>
              <h1 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>
                Order Checkout
              </h1>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {tableInfo?.branchName || "Restaurant Dine-In"}
              </p>
            </div>
          </div>

          {/* Table Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "100px",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              color: "var(--accent)",
              fontSize: "0.75rem",
              fontWeight: 800,
            }}
          >
            <span>🪑</span>
            <span>Table {tableInfo?.tableNumber ?? "—"}</span>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Error / Pending Order Banner */}
        {error && (
          <div
            className="animate-fade-in"
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#f87171",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <span style={{ fontSize: "1.1rem" }}>⚠️</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{error}</span>
            </div>
            {pendingOrder && (
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={handleRetryPendingPayment}
                  disabled={loading}
                  className="btn-accent tap-scale"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}
                >
                  ⚡ Retry Online Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    storage.setCart([]);
                    router.push(`/orders/${pendingOrder.id}`);
                  }}
                  className="btn-ghost tap-scale"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Pay at Counter Instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 1. Digital Bill & Phone Section (No OTP Roadblock) ── */}
        <section
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-card)",
            borderRadius: "18px",
            border: phoneError ? "1.5px solid #ef4444" : "1px solid var(--border)",
            padding: "16px",
            boxShadow: "var(--card-shadow)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle decorative glow */}
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              width: "100px",
              height: "100px",
              background: "var(--accent-glow)",
              borderRadius: "50%",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🧾</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
                  Digital Bill & Live Updates
                </h2>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "0.74rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.3,
                  }}
                >
                  Your receipt, tax invoice & food status will be sent here via SMS / WhatsApp.
                </p>
              </div>
            </div>
            {user && !isEditingPhone ? (
              <span
                style={{
                  background: "rgba(34,197,94,0.12)",
                  color: "#4ade80",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "100px",
                  whiteSpace: "nowrap",
                }}
              >
                Verified ✓
              </span>
            ) : (
              <span
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent)",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "100px",
                  whiteSpace: "nowrap",
                }}
              >
                No OTP Needed
              </span>
            )}
          </div>

          {user && !isEditingPhone ? (
            /* Logged in state display */
            <div
              style={{
                marginTop: "10px",
                padding: "12px 14px",
                borderRadius: "12px",
                background: "var(--tag-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem" }}>
                  {user.fullName || "Guest Customer"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--accent)" }}>
                    📱 +91 {user.phone.replace(/^\+91/, "")}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>• Bill destination</span>
                </div>
              </div>
              <button
                type="button"
                className="tap-scale"
                onClick={() => setIsEditingPhone(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "6px 8px",
                }}
              >
                Change
              </button>
            </div>
          ) : (
            /* Guest / Editing Phone Input Form */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              {/* Phone Input with +91 */}
              <div>
                <label
                  htmlFor="customer-phone-input"
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    marginBottom: "5px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Mobile Number for Bill & Tracking *
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span
                    style={{
                      padding: "10px 12px",
                      background: "var(--tag-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </span>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      id="customer-phone-input"
                      ref={phoneInputRef}
                      type="tel"
                      className="input-field"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setPhone(val);
                        if (val.length === 10) setPhoneError("");
                      }}
                      maxLength={10}
                      style={{
                        padding: "10px 14px",
                        fontSize: "0.92rem",
                        width: "100%",
                        borderColor: phoneError ? "#ef4444" : undefined,
                      }}
                    />
                    {phone.length === 10 && (
                      <span
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#22c55e",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
                {phoneError && (
                  <p style={{ margin: "5px 0 0", fontSize: "0.75rem", color: "#f87171", fontWeight: 600 }}>
                    {phoneError}
                  </p>
                )}
              </div>

              {/* Optional Name */}
              <div>
                <label
                  htmlFor="customer-name-input"
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    marginBottom: "5px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Your Name (Optional)
                </label>
                <input
                  id="customer-name-input"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ padding: "10px 14px", fontSize: "0.88rem" }}
                />
              </div>

              {/* Trust / Privacy guarantee badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "rgba(34,197,94,0.06)",
                  border: "1px solid rgba(34,197,94,0.15)",
                  fontSize: "0.72rem",
                  color: "var(--text-secondary)",
                }}
              >
                <span>🔒</span>
                <span>Zero spam guarantee. Used exclusively for your digital bill & dining alerts.</span>
              </div>
            </div>
          )}
        </section>

        {/* ── 2. Order Items Review ── */}
        <section
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-card)",
            borderRadius: "18px",
            border: "1px solid var(--border)",
            padding: "16px",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              paddingBottom: "10px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🍽️</span>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 800, margin: 0 }}>
                Selected Dishes ({totalItems})
              </h2>
            </div>
            <button
              onClick={() => router.push("/menu")}
              className="tap-scale"
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              + Add More
            </button>
          </div>

          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 12px", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.8rem", margin: "0 0 6px" }}>🛒</p>
              <p style={{ fontSize: "0.9rem", margin: "0 0 12px" }}>Your cart is empty.</p>
              <button
                className="btn-accent tap-scale"
                onClick={() => router.push("/menu")}
                style={{ padding: "8px 18px", borderRadius: "10px", fontSize: "0.82rem" }}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {cart.map((c) => {
                const rawPrice = c.item.dineInPrice ?? c.item.discountedPrice ?? c.item.price;
                const price = Number(c.unitPrice ?? rawPrice) || 0;
                const qty = Number(c.quantity) || 1;
                const selectedAddOns = (c.item.addOns ?? []).filter((addon) => c.addOnIds?.includes(addon.id));
                return (
                  <div
                    key={`${c.item.id}-${c.portion}-${(c.addOnIds ?? []).join("-")}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    {/* Item Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: c.item.isVeg ? "#22c55e" : "#ef4444",
                            flexShrink: 0,
                          }}
                        />
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.item.name}
                        </p>
                      </div>
                      <p style={{ margin: "2px 0 0 14px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {c.portion || "Full"}{selectedAddOns.length ? ` · ${selectedAddOns.map((addon) => addon.name).join(", ")}` : ""} · ₹{price.toFixed(0)} each
                      </p>
                    </div>

                    {/* Stepper */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "var(--tag-bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "3px 6px",
                      }}
                    >
                      <button
                        className="qty-btn tap-scale"
                        onClick={() => updateQuantity(c.item.id, -1)}
                        style={{
                          border: "none",
                          width: "28px",
                          height: "28px",
                          fontSize: c.quantity === 1 ? "0.85rem" : "1.05rem",
                          color: c.quantity === 1 ? "#f87171" : "var(--text-primary)",
                          transition: "color 0.15s ease",
                        }}
                        aria-label={c.quantity === 1 ? "Remove item" : "Decrease quantity"}
                      >
                        {c.quantity === 1 ? "🗑️" : "−"}
                      </button>
                      <span style={{ fontWeight: 800, fontSize: "0.85rem", minWidth: "16px", textAlign: "center" }}>
                        {c.quantity}
                      </span>
                      <button
                        className="qty-btn tap-scale"
                        onClick={() => updateQuantity(c.item.id, 1)}
                        style={{ border: "none", width: "28px", height: "28px", fontSize: "1.05rem" }}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Price */}
                    <span style={{ fontWeight: 800, fontSize: "0.92rem", minWidth: "52px", textAlign: "right" }}>
                      ₹{((Number(price) || 0) * (Number(qty) || 1)).toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cooking instructions note */}
          <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <label
              htmlFor="special-instructions-input"
              style={{
                display: "block",
                color: "var(--text-secondary)",
                fontSize: "0.72rem",
                fontWeight: 700,
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Special Instructions for the Kitchen
            </label>
            <input
              id="special-instructions-input"
              type="text"
              className="input-field"
              placeholder="e.g. Extra spicy, no onions, cutlery needed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ padding: "10px 14px", fontSize: "0.85rem" }}
            />
            {/* Quick Note Pills */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              {["🌶️ Extra spicy", "🌿 Less spicy", "🧅 No onions", "🍽️ Extra cutlery", "🥤 Drinks first"].map((tag) => {
                const isSelected = notes.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className="tap-scale"
                    onClick={() => {
                      if (isSelected) {
                        setNotes((prev) => prev.replace(tag, "").replace(/,\s*,/g, ",").trim());
                      } else {
                        setNotes((prev) => (prev ? `${prev}, ${tag}` : tag));
                      }
                    }}
                    style={{
                      background: isSelected ? "var(--accent-bg)" : "var(--tag-bg)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                      borderRadius: "100px",
                      padding: "3px 10px",
                      fontSize: "0.72rem",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 3. Table Location Confirmation ── */}
        <section
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-card)",
            borderRadius: "18px",
            border: locationStatus === "verified" ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--border)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: locationStatus === "verified" ? "rgba(34,197,94,0.15)" : "var(--accent-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                flexShrink: 0,
              }}
            >
              {locationStatus === "verified" ? "✓" : "📍"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800 }}>
                  {locationStatus === "verified" ? "Table Location Verified" : "Verify Table Location"}
                </h3>
                {locationStatus === "verified" && (
                  <span
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      color: "#4ade80",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "6px",
                    }}
                  >
                    On-Site
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {locationStatus === "verified"
                  ? `Seated at ${tableInfo?.branchName ?? "restaurant"}. Ready for dine-in service.`
                  : "Dine-in orders require confirming you are on-site at this table."}
              </p>
            </div>
          </div>

          {locationStatus !== "verified" && (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                className="btn-accent tap-scale"
                onClick={() => handleVerifyLocation(false)}
                disabled={locationStatus === "requesting"}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                {locationStatus === "requesting" ? "Checking GPS..." : "📍 Allow Location"}
              </button>
              <button
                type="button"
                className="btn-ghost tap-scale"
                onClick={() => handleVerifyLocation(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                Verify Table (Demo)
              </button>
            </div>
          )}
          {locationError && (
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#f87171" }}>
              {locationError}
            </p>
          )}
        </section>

        {/* ── 4. Payment Method Selection (In-Place) ── */}
        <section
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-card)",
            borderRadius: "18px",
            border: "1px solid var(--border)",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontSize: "16px" }}>💳</span>
            <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800 }}>
              Payment Method
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* Pay Online */}
            <div
              className="tap-scale"
              onClick={() => setPaymentMethod("online")}
              style={{
                padding: "14px",
                borderRadius: "14px",
                border: paymentMethod === "online" ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: paymentMethod === "online" ? "var(--accent-bg)" : "var(--tag-bg)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "20px" }}>⚡</span>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: paymentMethod === "online" ? "4px solid var(--accent)" : "1.5px solid var(--border)",
                  }}
                />
              </div>
              <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: "0.88rem" }}>Pay Online</p>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>UPI, Cards, GPay (In-Place)</p>
            </div>

            {/* Pay at Counter */}
            <div
              className="tap-scale"
              onClick={() => setPaymentMethod("cod")}
              style={{
                padding: "14px",
                borderRadius: "14px",
                border: paymentMethod === "cod" ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: paymentMethod === "cod" ? "var(--accent-bg)" : "var(--tag-bg)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "20px" }}>💵</span>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: paymentMethod === "cod" ? "4px solid var(--accent)" : "1.5px solid var(--border)",
                  }}
                />
              </div>
              <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: "0.88rem" }}>Pay at Counter</p>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>Cash / Card after meal</p>
            </div>
          </div>
        </section>

        {/* ── 5. Bill Summary Card ── */}
        <section
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-card)",
            borderRadius: "18px",
            border: "1px solid var(--border)",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800 }}>
              Bill Details
            </h3>
            <span
              style={{
                fontSize: "0.7rem",
                color: "#16a34a",
                background: "rgba(22, 163, 74, 0.1)",
                padding: "2px 8px",
                borderRadius: "100px",
                fontWeight: 700,
              }}
            >
              Food GST Included ✓
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "9px", fontSize: "0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Item Total ({totalItems} items)</span>
                <span style={{ display: "block", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  Inclusive of all restaurant food taxes
                </span>
              </div>
              <span style={{ fontWeight: 600 }}>₹{(Number(itemTotal) || 0).toFixed(2)}</span>
            </div>

            {/* Platform Convenience Fee Section */}
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                background: "var(--tag-bg)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "14px" }}>⚡</span>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                    Platform Convenience Fee
                  </span>
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--accent)" }}>
                  ₹{(Number(totalConvenienceCharge) || 0).toFixed(2)}
                </span>
              </div>

              {/* Fee Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingLeft: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  <span>• SaaS Convenience Charge (6%)</span>
                  <span>₹{(Number(baseConvenienceFee) || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  <span>• GST on Convenience Fee (18%)</span>
                  <span>₹{(Number(gstOnConvenienceFee) || 0).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.3 }}>
                For table QR self-ordering, digital invoicing & instant kitchen preparation updates.
              </div>
            </div>

            {/* Total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "8px",
                marginTop: "4px",
                borderTop: "1px solid var(--border)",
                fontWeight: 900,
                fontSize: "1.05rem",
              }}
            >
              <span>Total Amount</span>
              <span style={{ color: "var(--accent)", fontSize: "1.15rem" }}>
                ₹{(Number(grandTotal) || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* ── Terms & Conditions Acceptance ── */}
        <div
          className="liquid-glass"
          style={{
            padding: "14px 16px",
            borderRadius: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginTop: "16px",
            marginBottom: "16px",
            background: acceptedTerms ? "rgba(34, 197, 94, 0.04)" : "rgba(255, 255, 255, 0.03)",
            border: acceptedTerms ? "1.5px solid rgba(34, 197, 94, 0.4)" : "1px solid var(--border)",
            transition: "all 0.25s ease",
          }}
        >
          <input
            type="checkbox"
            id="checkout-terms-checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            style={{
              marginTop: "3px",
              width: "18px",
              height: "18px",
              accentColor: "var(--accent)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <label
            htmlFor="checkout-terms-checkbox"
            style={{
              fontSize: "0.78rem",
              lineHeight: 1.45,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            I accept the <strong style={{ color: "var(--text-primary)" }}>Terms & Conditions</strong>. We are a service and technology platform provider and do not own, prepare, or guarantee the food quality or preparation.
          </label>
        </div>
      </main>

      {/* ── Fixed Bottom Placement Dock ── */}
      <footer
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          background: "var(--bg-dock)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Total Amount
            </span>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1 }}>
              ₹{(Number(grandTotal) || 0).toFixed(2)}
            </div>
          </div>

          <button
            className="btn-accent tap-scale"
            onClick={handlePlaceOrder}
            disabled={loading || cart.length === 0 || !acceptedTerms}
            style={{
              flex: 1,
              maxWidth: "280px",
              height: "50px",
              borderRadius: "14px",
              fontSize: "0.95rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: acceptedTerms ? "0 8px 24px var(--accent-glow)" : "none",
              opacity: acceptedTerms ? 1 : 0.6,
              cursor: acceptedTerms ? "pointer" : "not-allowed",
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span style={{ fontSize: "0.85rem" }}>{paymentStatusText || "Submitting..."}</span>
              </>
            ) : (
              <>
                <span>{paymentMethod === "online" ? "Pay & Place Order" : "Place Order"}</span>
                <span style={{ fontSize: "1.1rem" }}>→</span>
              </>
            )}
          </button>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type} anim-pop`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
