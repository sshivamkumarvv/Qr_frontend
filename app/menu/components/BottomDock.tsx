"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MenuItem, CartItem, storage } from "@/lib/api";
import { getCategoryIcon } from "./menuUtils";
import { Plus, Minus, X } from "lucide-react";

export interface BottomDockProps {
  totalItems: number;
  totalPrice: number;
  tableInfo: ReturnType<typeof storage.getTableInfo>;
  cartBump: boolean;
  showCategoryMenu: boolean;
  setShowCategoryMenu: React.Dispatch<React.SetStateAction<boolean>>;
  categories: { id: string; name: string }[];
  activeCategory: string;
  selectCategory: (id: string) => void;
  isRealFilter: boolean;
  items: MenuItem[];
  cart?: CartItem[];
  onAdd?: (item: MenuItem, portion?: string, instructions?: string, addOnIds?: string[]) => void;
  onRemove?: (id: string, portion?: string, addOnIds?: string[]) => void;
}

export function BottomDock({
  totalItems,
  totalPrice,
  tableInfo,
  cartBump,
  showCategoryMenu,
  setShowCategoryMenu,
  categories,
  activeCategory,
  selectCategory,
  isRealFilter,
  items,
  cart = [],
  onAdd,
  onRemove,
}: BottomDockProps) {
  const router = useRouter();
  const [showCartQuickView, setShowCartQuickView] = useState(false);

  useEffect(() => {
    if (totalItems === 0 && showCartQuickView) {
      setShowCartQuickView(false);
    }
  }, [totalItems, showCartQuickView]);

  return (
    <>
      {/* Background gradient scrim */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "max(88px, calc(72px + env(safe-area-inset-bottom, 0px)))",
          background: "var(--dock-scrim)",
          zIndex: 29,
          pointerEvents: "none",
        }}
      />

      {/* The dock row — cart on the left (primary action), category menu on the right */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 32,
          paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
          paddingTop: "10px",
          paddingLeft: "16px",
          paddingRight: "16px",
          overflow: "visible",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            display: "flex",
            gap: "10px",
            alignItems: "stretch",
            overflow: "visible",
          }}
        >
          {/* View Cart / Checkout button — primary action */}
          {totalItems > 0 ? (
            <div
              className={`dock-btn tap-scale ${cartBump ? "animate-bounce-in" : ""}`}
              id="view-cart-btn"
              onClick={() => setShowCartQuickView(true)}
              role="button"
              tabIndex={0}
              aria-label={`View cart — ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px 0 14px",
                height: "56px",
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.22)",
                cursor: "pointer",
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
                boxShadow: "0 10px 32px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)",
                color: "#ffffff",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                overflow: "visible",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, overflow: "visible" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "rgba(0,0,0,0.28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: 0,
                    position: "relative",
                    overflow: "visible",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
                  }}
                >
                  🛍️
                  <span
                    style={{
                      position: "absolute",
                      top: "-5px",
                      right: "-7px",
                      background: "#ffffff",
                      color: "var(--accent)",
                      fontSize: "0.72rem",
                      fontWeight: 900,
                      borderRadius: "999px",
                      padding: "0 5px",
                      height: "20px",
                      minWidth: "20px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
                      lineHeight: 1,
                      border: "1.5px solid var(--accent)",
                      zIndex: 10,
                      boxSizing: "border-box",
                      overflow: "visible",
                    }}
                  >
                    {totalItems}
                  </span>
                </div>
                <div style={{ textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: "1.05rem",
                      lineHeight: 1.15,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    ₹{totalPrice.toFixed(0)}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      opacity: 0.95,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>{totalItems} {totalItems === 1 ? "item" : "items"}</span>
                    <span>·</span>
                    <span style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}>Quick View ↑</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/checkout");
                }}
                className="tap-scale"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  background: "rgba(0,0,0,0.22)",
                  border: "none",
                  color: "#ffffff",
                  padding: "8px 13px",
                  borderRadius: "12px",
                  flexShrink: 0,
                  marginLeft: "6px",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <span>Checkout</span>
                <span style={{ fontSize: "1rem" }}>→</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "0 14px",
                height: "56px",
                borderRadius: "20px",
                background: "var(--bg-dock)",
                border: "1px solid var(--border)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "var(--card-shadow)",
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "17px",
                  flexShrink: 0,
                }}
              >
                🛒
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Your cart is empty
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Add dishes from menu
                </div>
              </div>
            </div>
          )}

          {/* Category button — on the right side of the checkout dock */}
          <button
            id="category-menu-btn"
            className="dock-btn tap-scale"
            onClick={() => setShowCategoryMenu((v) => !v)}
            aria-label="Browse categories"
            aria-expanded={showCategoryMenu}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0 20px",
              height: "56px",
              borderRadius: "20px",
              background: showCategoryMenu
                ? "var(--accent)"
                : "var(--liquid-glass-bg)",
              border: `1.5px solid ${showCategoryMenu ? "var(--accent)" : "var(--liquid-glass-border)"}`,
              backdropFilter: "blur(28px) saturate(190%)",
              WebkitBackdropFilter: "blur(28px) saturate(190%)",
              color: showCategoryMenu ? "#ffffff" : "var(--text-primary)",
              fontWeight: 800,
              fontSize: "0.92rem",
              cursor: "pointer",
              boxShadow: showCategoryMenu
                ? "0 8px 24px var(--accent-glow)"
                : "var(--liquid-glass-shadow)",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1, fontWeight: 900 }}>
              {showCategoryMenu ? "✕" : "≡"}
            </span>
            <span>{showCategoryMenu ? "Close" : "Menu"}</span>
            {isRealFilter && !showCategoryMenu && (
              <span
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent)",
                  border: "2px solid var(--bg-primary)",
                }}
              />
            )}
          </button>
        </div>
      </div>

        {/* Liquid Glass Category Popover directly above the Menu button */}
        {showCategoryMenu && (
          <>
            {/* Click-away backdrop */}
            <div
              onClick={() => setShowCategoryMenu(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 48,
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            />
            <div
              className="anim-pop"
              style={{
                position: "fixed",
                bottom: "calc(max(14px, env(safe-area-inset-bottom, 14px)) + 68px)",
                right: "16px",
                width: "290px",
                maxHeight: "390px",
                zIndex: 49,
                background: "var(--liquid-glass-bg)",
                backdropFilter: "blur(32px) saturate(200%)",
                WebkitBackdropFilter: "blur(32px) saturate(200%)",
                border: "1.5px solid var(--liquid-glass-border)",
                borderRadius: "24px",
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.2)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transformOrigin: "bottom right",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.01em" }}>
                    Categories
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--accent)",
                      background: "var(--accent-bg)",
                      border: "1px solid var(--accent-border)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {categories.length}
                  </span>
                </div>

                <button
                  onClick={() => setShowCategoryMenu(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label="Close categories"
                >
                  ✕
                </button>
              </div>

              {/* Clean Categories List (Name + Count ONLY, No Icons) */}
              <div
                className="hide-scrollbar"
                style={{
                  overflowY: "auto",
                  padding: "8px 10px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {categories.map((cat) => {
                  const count =
                    cat.id === "ALL"
                      ? items.filter((i) => i.isAvailable).length
                      : cat.id === "VEG"
                      ? items.filter((i) => i.isAvailable && i.isVeg).length
                      : cat.id === "FEATURED"
                      ? items.filter((i) => i.isAvailable && i.isFeatured).length
                      : items.filter((i) => i.isAvailable && i.categoryId === cat.id).length;

                  const isSelected = activeCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat.id)}
                      className="tap-scale"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "14px",
                        border: isSelected
                          ? "1px solid var(--accent-border)"
                          : "1px solid transparent",
                        background: isSelected
                          ? "var(--accent-bg)"
                          : "transparent",
                        color: isSelected ? "var(--accent)" : "var(--text-primary)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "0.88rem",
                        fontWeight: isSelected ? 800 : 500,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Name - simple and clean, no icons */}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          paddingRight: "8px",
                        }}
                      >
                        {cat.name}
                      </span>

                      {/* Items Count Pill */}
                      <span
                        style={{
                          fontSize: "0.74rem",
                          padding: "3px 9px",
                          borderRadius: "100px",
                          background: isSelected
                            ? "var(--accent)"
                            : "var(--tag-bg)",
                          color: isSelected ? "#ffffff" : "var(--text-muted)",
                          fontWeight: 700,
                          flexShrink: 0,
                          minWidth: "24px",
                          textAlign: "center",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Liquid Glass Cart Quick View Sheet */}
        {showCartQuickView && cart && cart.length > 0 && (
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
              {/* Grab Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingTop: "10px", paddingBottom: "2px" }}>
                <div style={{ width: "36px", height: "4px", borderRadius: "999px", background: "var(--border)" }} />
              </div>

              {/* Header */}
              <div
                style={{
                  padding: "12px 20px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                    Table Cart
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {totalItems} item{totalItems > 1 ? "s" : ""} · Table {tableInfo?.tableNumber ?? "—"}
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
                  aria-label="Close cart quick view"
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
                  gap: "10px",
                  flex: 1,
                }}
              >
                {cart.map((cartItem) => {
                  const rawPrice = cartItem.unitPrice ?? cartItem.item.dineInPrice ?? cartItem.item.discountedPrice ?? cartItem.item.price;
                  const price = Number(rawPrice) || 0;
                  const itemSubtotal = price * cartItem.quantity;
                  const isVeg = Boolean(cartItem.item.isVeg ?? (cartItem.item as any).dietary === "veg");

                  return (
                    <div
                      key={`${cartItem.item.id}-${cartItem.portion || "std"}-${(cartItem.addOnIds || []).join("-")}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "4px",
                            border: `1.5px solid ${isVeg ? "#16a34a" : "#dc2626"}`,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: "3px",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: isVeg ? "#16a34a" : "#dc2626",
                            }}
                          />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                            {cartItem.item.name}
                          </div>
                          {cartItem.portion && (
                            <div style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600 }}>
                              {cartItem.portion}
                            </div>
                          )}
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            ₹{price} each
                          </div>
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
                          onClick={() => onRemove && onRemove(cartItem.item.id, cartItem.portion, cartItem.addOnIds)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px",
                          }}
                          aria-label={`Decrease ${cartItem.item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, minWidth: "16px", textAlign: "center", color: "var(--accent)" }}>
                          {cartItem.quantity}
                        </span>
                        <button
                          onClick={() => onAdd && onAdd(cartItem.item, cartItem.portion, cartItem.specialInstructions, cartItem.addOnIds)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px",
                          }}
                          aria-label={`Increase ${cartItem.item.name}`}
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
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total Amount</span>
                  <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--text-primary)" }}>
                    ₹{totalPrice.toFixed(0)}
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
                    border: "none",
                    color: "#ffffff",
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
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
                  Continue Browsing Menu
                </button>
              </div>
            </div>
          </>
        )}
    </>
  );
}
