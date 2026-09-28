"use client";

import React, { useState } from "react";
import { MenuItem } from "@/lib/api";
import { getPairingItems, getPairingLabel } from "./menuUtils";
import { Sparkles, Plus, Check, X, Flame } from "lucide-react";

export interface InlinePairingStripProps {
  triggerItem: MenuItem;
  allItems: MenuItem[];
  cartItemIds: string[];
  onAdd: (item: MenuItem) => void;
  onDismiss: () => void;
}

export function InlinePairingStrip({
  triggerItem,
  allItems,
  cartItemIds,
  onAdd,
  onDismiss,
}: InlinePairingStripProps) {
  const pairings = getPairingItems(triggerItem, allItems, cartItemIds);
  const label = getPairingLabel(triggerItem);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  if (pairings.length === 0) return null;

  function handleAdd(item: MenuItem) {
    onAdd(item);
    setAddedIds((prev) => new Set([...prev, item.id]));
  }

  return (
    <div
      className="animate-bloom"
      style={{
        margin: "12px 0 4px",
        paddingTop: "14px",
        borderTop: "1px solid var(--liquid-glass-border)",
        position: "relative",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px 10px",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              flexShrink: 0,
              boxShadow: "0 0 12px var(--accent-glow)",
            }}
          >
            <Sparkles size={12} strokeWidth={2.4} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.84rem",
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
              }}
            >
              Pairs with {triggerItem.name}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "0.64rem",
              fontWeight: 700,
              color: "var(--accent)",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              padding: "2px 8px",
              borderRadius: "100px",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            <Flame size={10} strokeWidth={2.5} /> Recommended
          </span>
          <button
            onClick={onDismiss}
            className="tap-scale"
            aria-label="Dismiss recommendations"
            style={{
              background: "var(--tag-bg)",
              border: "1px solid var(--apple-glass-border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* Horizontal scroll cards */}
      <div
        className="hide-scrollbar scroll-touch"
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          padding: "2px 8px 6px",
          scrollSnapType: "x mandatory",
        }}
      >
        <div style={{ display: "flex", gap: "10px", width: "max-content" }}>
          {pairings.map((item, i) => {
            const price = item.dineInPrice ?? item.discountedPrice ?? item.price;
            const added = addedIds.has(item.id) || cartItemIds.includes(item.id);
            const CARD_W = 138;
            const IMG_H = 88;

            return (
              <div
                key={item.id}
                className="animate-rec-card tap-scale"
                style={{
                  animationDelay: `${i * 0.04}s`,
                  scrollSnapAlign: "start",
                  width: `${CARD_W}px`,
                  flexShrink: 0,
                  background: "var(--liquid-glass-card)",
                  backdropFilter: "blur(24px) saturate(190%)",
                  WebkitBackdropFilter: "blur(24px) saturate(190%)",
                  border: added
                    ? "1.5px solid var(--success)"
                    : "1px solid var(--liquid-glass-border)",
                  boxShadow: added
                    ? "0 4px 18px rgba(34, 197, 94, 0.22)"
                    : "var(--liquid-glass-shadow), var(--liquid-glass-specular)",
                  borderRadius: "16px",
                  overflow: "hidden",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Thumbnail */}
                {item.imageUrl ? (
                  <div
                    style={{
                      width: "100%",
                      height: `${IMG_H}px`,
                      overflow: "hidden",
                      background: "var(--bg-secondary)",
                      borderRadius: "11px",
                      position: "relative",
                    }}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.3s ease",
                      }}
                      loading="lazy"
                    />
                    {/* Veg/Non-veg tag */}
                    <span
                      style={{
                        position: "absolute",
                        top: "5px",
                        left: "5px",
                        width: "14px",
                        height: "14px",
                        borderRadius: "3px",
                        border: `2px solid ${item.isVeg ? "#22c55e" : "#ef4444"}`,
                        background: "var(--bg-card)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      <span
                        style={{
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          background: item.isVeg ? "#22c55e" : "#ef4444",
                          display: "block",
                        }}
                      />
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: `${IMG_H}px`,
                      background: "var(--accent-bg)",
                      border: "1px dashed var(--accent-border)",
                      borderRadius: "11px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    {item.isVeg ? "🥦" : "🍖"}
                  </div>
                )}

                {/* Info */}
                <div style={{ padding: "8px 2px 4px" }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "0.76rem",
                      lineHeight: 1.25,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      marginBottom: "4px",
                      minHeight: "2em",
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.name}
                  </p>
                  <p
                    style={{
                      color: "var(--accent)",
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      marginBottom: "8px",
                    }}
                  >
                    ₹{price}
                  </p>
                  <button
                    id={`pair-add-${item.id}`}
                    onClick={() => handleAdd(item)}
                    disabled={added}
                    aria-label={added ? `${item.name} added` : `Add ${item.name} to cart`}
                    style={{
                      width: "100%",
                      padding: "6px 0",
                      borderRadius: "9px",
                      border: added ? "1px solid var(--success)" : "none",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: added ? "default" : "pointer",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      background: added
                        ? "rgba(34, 197, 94, 0.14)"
                        : "linear-gradient(135deg, var(--accent), var(--accent-2))",
                      color: added ? "var(--success)" : "#ffffff",
                      boxShadow: added ? "none" : "0 3px 10px var(--accent-glow)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    {added ? (
                      <>
                        <Check size={12} strokeWidth={2.8} /> Added
                      </>
                    ) : (
                      <>
                        <Plus size={12} strokeWidth={2.8} /> Add
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
