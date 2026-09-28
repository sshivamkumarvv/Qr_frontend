"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { MenuItem, storage } from "@/lib/api";
import { getCategoryIcon } from "./menuUtils";

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
}: BottomDockProps) {
  const router = useRouter();

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
            <button
              className={`dock-btn tap-scale ${cartBump ? "animate-bounce-in" : ""}`}
              id="view-cart-btn"
              onClick={() => router.push("/checkout")}
              aria-label={`Go to checkout — ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
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
                      opacity: 0.92,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {totalItems} {totalItems === 1 ? "item" : "items"} · Table {tableInfo?.tableNumber ?? "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  background: "rgba(0,0,0,0.22)",
                  padding: "8px 13px",
                  borderRadius: "12px",
                  flexShrink: 0,
                  marginLeft: "6px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <span>Checkout</span>
                <span style={{ fontSize: "1rem" }}>→</span>
              </div>
            </button>
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

          {/* Category button — on the right */}
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
              gap: "7px",
              padding: "0 18px",
              height: "56px",
              borderRadius: "20px",
              background: showCategoryMenu
                ? "var(--accent-bg)"
                : "var(--bg-dock)",
              border: `1.5px solid ${showCategoryMenu ? "var(--accent)" : "var(--border)"}`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color: showCategoryMenu ? "var(--accent)" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: showCategoryMenu
                ? "0 6px 24px var(--accent-glow)"
                : "var(--card-shadow)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>
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

        {/* Category List Popover directly above the Menu button */}
        {showCategoryMenu && (
          <>
            {/* Click-away backdrop */}
            <div
              onClick={() => setShowCategoryMenu(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 48,
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
              }}
            />
            <div
              className="anim-pop"
              style={{
                position: "fixed",
                bottom: "calc(max(14px, env(safe-area-inset-bottom, 14px)) + 66px)",
                right: "16px",
                width: "270px",
                maxHeight: "360px",
                zIndex: 49,
                background: "var(--bg-card)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid var(--border)",
                borderRadius: "20px",
                boxShadow: "var(--card-shadow)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transformOrigin: "bottom right",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "14px" }}>📖</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                    Categories
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--accent)",
                    background: "rgba(255,107,43,0.14)",
                    padding: "2px 7px",
                    borderRadius: "10px",
                    fontWeight: 700,
                  }}
                >
                  {categories.length}
                </span>
              </div>

              {/* List */}
              <div
                className="hide-scrollbar"
                style={{
                  overflowY: "auto",
                  padding: "6px 8px 8px",
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
                        padding: "9px 12px",
                        borderRadius: "12px",
                        border: isSelected ? "1px solid var(--accent-border)" : "1px solid transparent",
                        background: isSelected ? "var(--accent-bg)" : "var(--tag-bg)",
                        color: isSelected ? "var(--accent)" : "var(--text-primary)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "0.86rem",
                        fontWeight: isSelected ? 700 : 500,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span style={{ fontSize: "16px" }}>{getCategoryIcon(cat.name)}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cat.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "2px 7px",
                          borderRadius: "10px",
                          background: isSelected ? "var(--accent)" : "var(--border)",
                          color: isSelected ? "#ffffff" : "var(--text-muted)",
                          fontWeight: 700,
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
      </div>
    </>
  );
}
