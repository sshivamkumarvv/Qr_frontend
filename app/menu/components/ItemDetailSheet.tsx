"use client";

import React, { useState } from "react";
import { MenuItem } from "@/lib/api";
import BottomSheet from "@/lib/BottomSheet";
import { X, Plus, Sparkles, ChefHat, Check } from "lucide-react";

export interface ItemDetailSheetProps {
  item: MenuItem;
  qty: number;
  onAdd: (portion?: string, specialInstructions?: string, addOnIds?: string[]) => void;
  onRemove?: (portion?: string) => void;
  onClose: () => void;
}

export function ItemDetailSheet({
  item,
  qty,
  onAdd,
  onRemove,
  onClose,
}: ItemDetailSheetProps) {
  const basePrice = item.dineInPrice ?? item.discountedPrice ?? item.price;
  const hasDiscount = basePrice < item.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - basePrice / item.price) * 100)
    : 0;

  // Customization state: Portion & Cooking Instructions
  const [selectedPortion, setSelectedPortion] = useState<"Full" | "Half">("Full");
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string>("");

  const halfPrice = Math.round(basePrice * 0.6);
  const portionPrice = selectedPortion === "Half" ? halfPrice : basePrice;
  const addOnPrice = (item.addOns ?? [])
    .filter((addon) => selectedAddOnIds.includes(addon.id))
    .reduce((sum, addon) => sum + Number(addon.price), 0);
  const activePrice = Number(portionPrice) + addOnPrice;

  const [descExpanded, setDescExpanded] = useState(false);
  const isLongDesc = !!item.description && item.description.length > 150;

  const SUGGESTIONS = [
    "Less spicy 🌶️",
    "Extra spicy 🔥",
    "No onion & garlic 🧅",
    "Extra crispy 🥓",
    "Less oil 🫒",
  ];

  const toggleSuggestion = (text: string) => {
    setInstructions((prev) => {
      const parts = prev.split(",").map((s) => s.trim()).filter(Boolean);
      const exists = parts.includes(text);
      if (exists) {
        return parts.filter((p) => p !== text).join(", ");
      } else {
        return parts.concat(text).join(", ");
      }
    });
  };

  const handleAddCustomized = () => {
    onAdd(selectedPortion, instructions.trim() || undefined, selectedAddOnIds);
    onClose();
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((selected) =>
      selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id],
    );
  };

  return (
    <BottomSheet
      isOpen={true}
      onClose={onClose}
      showHandle={true}
      maxHeight="92dvh"
      footer={
        <button
          className="btn-accent tap-scale"
          onClick={handleAddCustomized}
          style={{
            width: "100%",
            height: "54px",
            border: "none",
            borderRadius: "16px",
            fontSize: "0.98rem",
            fontWeight: 800,
            boxShadow: "0 8px 28px rgba(255,107,43,0.32)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Plus size={18} strokeWidth={2.6} />
          <span>Add to Cart ({selectedPortion})</span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span>₹{activePrice}</span>
        </button>
      }
    >
      <div style={{ margin: "-12px -20px 16px" }}>
        {/* ───────────── Hero image with Close Icon ───────────── */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "240px",
            flexShrink: 0,
            background: "var(--bg-secondary, #15151e)",
            overflow: "hidden",
          }}
        >
          {/* Prominent Close button in top-right */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="tap-scale"
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 20,
              boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
            }}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                pointerEvents: "none",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(circle at center, rgba(255,107,43,0.18), rgba(255,107,43,0.03))",
                fontSize: "72px",
              }}
            >
              {item.isVeg ? "🥦" : "🍖"}
            </div>
          )}

          {/* Image gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 35%, rgba(14,14,22,0.98) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Veg / Non-Veg indicator over image */}
          <div
            style={{
              position: "absolute",
              left: "18px",
              bottom: "22px",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 10px",
              borderRadius: "999px",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${item.isVeg ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
              color: item.isVeg ? "#4ade80" : "#f87171",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: item.isVeg ? "#22c55e" : "#ef4444",
                boxShadow: item.isVeg ? "0 0 8px rgba(34,197,94,0.6)" : "0 0 8px rgba(239,68,68,0.6)",
              }}
            />
            {item.isVeg ? "VEG" : "NON-VEG"}
          </div>

          {/* Popular badge */}
          {item.isFeatured && (
            <div
              style={{
                position: "absolute",
                right: "18px",
                bottom: "22px",
                padding: "6px 10px",
                borderRadius: "999px",
                background: "rgba(255,107,43,0.9)",
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 800,
                boxShadow: "0 4px 14px rgba(255,107,43,0.35)",
              }}
            >
              ★ Popular
            </div>
          )}
        </div>
      </div>

      {/* ───────────── Scrollable content ───────────── */}
      <div
        style={{
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div style={{ padding: "2px 0 0" }}>
          {/* Name */}
          <h2
            id={`item-title-${item.id}`}
            style={{
              margin: "0 0 8px",
              fontSize: "1.35rem",
              lineHeight: 1.25,
              fontWeight: 850,
              letterSpacing: "-0.025em",
              color: "var(--text-primary)",
            }}
          >
            {item.name}
          </h2>

          {/* Meta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
              color: "var(--text-muted)",
              fontSize: "0.75rem",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 9px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              ⏱ {item.preparationTime} min
            </span>

            {item.category?.name && (
              <>
                <span style={{ opacity: 0.35 }}>•</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.category.name}
                </span>
              </>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div style={{ marginBottom: "18px" }}>
              <p
                style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                  ...(!descExpanded && isLongDesc
                    ? ({
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties)
                    : {}),
                }}
              >
                {item.description}
              </p>

              {isLongDesc && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  style={{
                    marginTop: "5px",
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: "var(--accent)",
                    fontSize: "0.78rem",
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* ───────────── Price ───────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              padding: "14px 0",
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span
              style={{
                fontSize: "1.65rem",
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "-0.035em",
              }}
            >
              ₹{activePrice}
            </span>

            {hasDiscount && (
              <>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    textDecoration: "line-through",
                  }}
                >
                  ₹{item.price}
                </span>

                <span
                  style={{
                    padding: "4px 7px",
                    borderRadius: "6px",
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    color: "#4ade80",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                  }}
                >
                  {discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {/* ───────────── Customization: Portion Selection ───────────── */}
          <div
            style={{
              padding: "16px 0",
              borderTop: "1px solid rgba(255,255,255,0.07)",
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
                <span style={{ fontSize: "14px" }}>🍽️</span>
                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  Choose Portion
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700 }}>
                Required
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {[
                { name: "Full", label: "Full Portion", price: basePrice, badge: "Standard" },
                { name: "Half", label: "Half Portion", price: halfPrice, badge: "Save 40%" },
              ].map((portion) => {
                const isSelected = selectedPortion === portion.name;
                return (
                  <button
                    key={portion.name}
                    type="button"
                    onClick={() => setSelectedPortion(portion.name as "Full" | "Half")}
                    className="tap-scale"
                    style={{
                      padding: "12px",
                      borderRadius: "14px",
                      border: isSelected
                        ? "1.5px solid var(--accent)"
                        : "1px solid var(--border)",
                      background: isSelected
                        ? "var(--accent-bg)"
                        : "rgba(255, 255, 255, 0.02)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "4px",
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <span
                        style={{
                          fontWeight: isSelected ? 800 : 700,
                          fontSize: "0.85rem",
                          color: isSelected ? "var(--accent)" : "var(--text-primary)",
                        }}
                      >
                        {portion.label}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            background: "var(--accent)",
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                        ₹{portion.price}
                      </span>
                      <span
                        style={{
                          fontSize: "0.62rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: isSelected ? "rgba(255,107,43,0.2)" : "rgba(255,255,255,0.06)",
                          color: isSelected ? "var(--accent)" : "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        {portion.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {!!item.addOns?.length && (
            <div style={{ padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  Add something extra
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Optional</span>
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {item.addOns.map((addon) => {
                  const selected = selectedAddOnIds.includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "11px 12px",
                        border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                        borderRadius: "10px",
                        background: selected ? "var(--accent-bg)" : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleAddOn(addon.id)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <span style={{ flex: 1, fontSize: "0.84rem", fontWeight: 650 }}>{addon.name}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 750 }}>+₹{Number(addon.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ───────────── Cooking Instructions ───────────── */}
          <div
            style={{
              padding: "16px 0",
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <ChefHat size={16} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                Cooking Instructions
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                Optional
              </span>
            </div>

            {/* Quick suggestion tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
              {SUGGESTIONS.map((tag) => {
                const isSelected = instructions.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSuggestion(tag)}
                    className="tap-scale"
                    style={{
                      border: isSelected
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                      background: isSelected
                        ? "var(--accent-bg)"
                        : "rgba(255, 255, 255, 0.03)",
                      color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                      padding: "5px 10px",
                      borderRadius: "100px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                );
              })}
            </div>

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Less spicy, extra sauce, well cooked..."
              maxLength={150}
              rows={2}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "rgba(255, 255, 255, 0.03)",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
