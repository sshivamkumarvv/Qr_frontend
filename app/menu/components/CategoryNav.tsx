"use client";

import React from "react";

export interface CategoryNavProps {
  categories: { id: string; name: string }[];
  activeCategory: string;
  selectCategory: (catId: string) => void;
  catPillRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
}

export function CategoryNav({
  categories,
  activeCategory,
  selectCategory,
  catPillRefs,
}: CategoryNavProps) {
  return (
    <nav
      aria-label="Menu categories"
      style={{
        padding: "6px 0 8px",
      }}
    >
      <div
        className="hide-scrollbar scroll-touch"
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          paddingLeft: "16px",
          paddingRight: "16px",
          scrollSnapType: "x mandatory",
        }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              ref={(el) => {
                catPillRefs.current[cat.id] = el;
              }}
              className="tap-scale"
              onClick={() => selectCategory(cat.id)}
              style={{
                scrollSnapAlign: "start",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "100px",
                border: isActive
                  ? "1px solid transparent"
                  : "1px solid rgba(255,255,255,0.08)",
                background: isActive
                  ? "linear-gradient(135deg, #ff6b2b, #ff9a3c)"
                  : "rgba(255,255,255,0.04)",
                color: isActive ? "#ffffff" : "var(--text-secondary)",
                fontSize: "0.78rem",
                fontWeight: isActive ? 750 : 550,
                whiteSpace: "nowrap",
                cursor: "pointer",
                boxShadow: isActive
                  ? "0 4px 14px rgba(255,107,43,0.38)"
                  : "none",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
