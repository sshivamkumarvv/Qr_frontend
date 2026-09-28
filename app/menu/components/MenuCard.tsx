"use client";

import React, { useState } from "react";
import { MenuItem } from "@/lib/api";
import { Plus, Minus, Sparkles } from "lucide-react";
import { isItemCustomizable } from "./menuUtils";

const DESC_EXPAND_THRESHOLD = 65;

export interface MenuCardProps {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpenSheet: () => void;
  onCardClick?: () => void;
  isSelected?: boolean;
  delay: number;
}

export function MenuCard({
  item,
  qty,
  onAdd,
  onRemove,
  onOpenSheet,
  onCardClick,
  isSelected = false,
  delay,
}: MenuCardProps) {
  const price = item.dineInPrice ?? item.discountedPrice ?? item.price;
  const hasDiscount = price < item.price;
  const isCustomizable = isItemCustomizable(item);
  const IMG_SIZE = 120;
  const OVERLAP = isCustomizable ? 24 : 18;
  const [expanded, setExpanded] = useState(false);
  const isLongDesc = !!item.description && item.description.length > DESC_EXPAND_THRESHOLD;

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick();
    } else {
      onOpenSheet();
    }
  };

  return (
    <div
      className={`anim-fade-up menu-item-card ${isSelected ? "menu-card-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Select ${item.name}`}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
      style={{
        animationDelay: `${delay}s`,
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        background: "transparent",
        padding: "14px 0",
      }}
    >
      {/* Left — text content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          paddingTop: "2px",
        }}
      >
        {/* Veg dot + Popular badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              border: `2px solid ${item.isVeg ? "#22c55e" : "#ef4444"}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: item.isVeg ? "#22c55e" : "#ef4444",
                display: "block",
              }}
            />
          </span>
          {item.isFeatured && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "100px",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent)",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              <Sparkles size={10} strokeWidth={2.4} /> Popular
            </span>
          )}
        </div>

        {/* Name */}
        <h3 style={{ fontWeight: 700, fontSize: "0.92rem", lineHeight: 1.25, margin: 0 }}>
          {item.name}
        </h3>

        {/* Description — ellipsis with tap-to-expand, stops sheet from opening */}
        {item.description && (
          <p
            onClick={(e) => {
              if (isLongDesc) {
                e.stopPropagation();
                setExpanded((v) => !v);
              }
            }}
            style={{
              color: "var(--text-muted)",
              fontSize: "0.74rem",
              lineHeight: 1.4,
              margin: 0,
              cursor: isLongDesc ? "pointer" : "default",
              ...(!expanded && isLongDesc
                ? ({
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  } as React.CSSProperties)
                : {}),
            }}
          >
            {item.description}
            {isLongDesc && (
              <span
                style={{
                  color: "var(--accent)",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  marginLeft: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                {expanded ? " less" : " more"}
              </span>
            )}
          </p>
        )}

        {/* Price + prep time */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
          <span style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.01em" }}>₹{price}</span>
          {hasDiscount && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", textDecoration: "line-through" }}>
              ₹{item.price}
            </span>
          )}
          <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", fontWeight: 500 }}>
            ⏱ {item.preparationTime}m
          </span>
        </div>
      </div>

      {/* Right — fixed-size image with the Add button / stepper overlaid on it */}
      <div
        style={{
          position: "relative",
          width: `${IMG_SIZE}px`,
          height: `${IMG_SIZE + OVERLAP}px`,
          flexShrink: 0,
        }}
      >
        {item.imageUrl ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenSheet();
            }}
            title="Click to view details"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${IMG_SIZE}px`,
              height: `${IMG_SIZE}px`,
              borderRadius: "16px",
              overflow: "hidden",
              background: "var(--bg-secondary)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
              cursor: "pointer",
            }}
          >
            <img
              src={item.imageUrl}
              alt={item.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${IMG_SIZE}px`,
              height: `${IMG_SIZE}px`,
              borderRadius: "16px",
              background: "rgba(255,107,43,0.06)",
              border: "1px dashed rgba(255,107,43,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
            }}
          >
            {item.isVeg ? "🥦" : "🍖"}
          </div>
        )}

        {/* Add / stepper — overlaid on the bottom edge; stops card click from firing */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "84%",
          }}
        >
          {qty === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <button
                className="btn-accent tap-scale"
                id={`add-item-${item.id}`}
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                aria-label={`Add ${item.name} to cart`}
                style={{
                  width: "100%",
                  padding: "6px 0",
                  borderRadius: "9px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <Plus size={13} strokeWidth={2.6} /> Add
              </button>
              {isCustomizable && (
                <span
                  style={{
                    fontSize: "0.62rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    marginTop: "2px",
                    lineHeight: 1,
                  }}
                >
                  customisable
                </span>
              )}
            </div>
          ) : (
            <div
              className="anim-pop"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-card, #16161f)",
                border: "1px solid var(--border-active)",
                borderRadius: "9px",
                padding: "2px 2px",
                boxShadow: "0 3px 10px rgba(0,0,0,0.4)",
              }}
            >
              <button
                className="qty-btn tap-scale"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                style={{
                  border: "none",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label={`Remove one ${item.name}`}
              >
                <Minus size={12} strokeWidth={2.6} />
              </button>
              <span
                style={{
                  fontWeight: 800,
                  minWidth: "16px",
                  textAlign: "center",
                  color: "var(--accent)",
                  fontSize: "0.82rem",
                }}
              >
                {qty}
              </span>
              <button
                className="qty-btn tap-scale"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                style={{
                  border: "none",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label={`Add another ${item.name}`}
              >
                <Plus size={12} strokeWidth={2.6} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
