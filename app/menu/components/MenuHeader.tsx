"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { storage } from "@/lib/api";
import { useTheme, THEME_COLOR_PRESETS } from "@/lib/theme";

export interface MenuHeaderProps {
  tableInfo: ReturnType<typeof storage.getTableInfo>;
  search: string;
  setSearch: (s: string) => void;
  showOptionsMenu: boolean;
  setShowOptionsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  user: { fullName: string } | null;
  children?: React.ReactNode;
}

export function MenuHeader({
  tableInfo,
  search,
  setSearch,
  showOptionsMenu,
  setShowOptionsMenu,
  user,
  children,
}: MenuHeaderProps) {
  const router = useRouter();
  const { mode, toggleMode, colorId, setColorId } = useTheme();
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <>
      {/* Top Restaurant info banner — scrolls away naturally with zero jitter */}
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "14px 16px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          {tableInfo?.restaurantLogo ? (
            <img
              src={tableInfo.restaurantLogo}
              alt={tableInfo.restaurantName || "Restaurant"}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                objectFit: "cover",
                border: "1px solid var(--border)",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 900,
                color: "#fff",
                boxShadow: "0 2px 8px var(--accent-glow)",
              }}
            >
              {(tableInfo?.restaurantName || tableInfo?.branchName || "R").charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {tableInfo?.restaurantName || tableInfo?.branchName || "Restaurant"}
            </div>
            {tableInfo?.branchName && tableInfo.branchName !== tableInfo.restaurantName && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.2, marginTop: "2px" }}>
                {tableInfo.branchName}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Table Pill + Theme Mode quick toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Quick Light/Dark Mode toggle */}
          <button
            onClick={toggleMode}
            className="tap-scale"
            aria-label={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "var(--tag-bg)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "15px",
              transition: "all 0.2s ease",
            }}
          >
            {mode === "light" ? "🌙" : "☀️"}
          </button>

          {/* Table Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              padding: "5px 12px",
              borderRadius: "100px",
              fontSize: "0.82rem",
              fontWeight: 800,
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            <span>🪑</span>
            <span>Table {tableInfo?.tableNumber ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* Unified Sticky Bar: Search + Category Pills */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 25,
          background: "var(--bg-header)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--card-shadow)",
          transition: "background-color 0.25s ease, border-color 0.25s ease",
        }}
      >
        <div
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            padding: "8px 16px 4px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {/* Search bar */}
          <div style={{ flex: 1, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "14px",
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              className="input-field"
              type="search"
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "9px 14px 9px 36px",
                fontSize: "0.9rem",
                transition: "border-color 0.2s, box-shadow 0.2s",
                width: "100%",
              }}
              aria-label="Search menu items"
            />
          </div>

          {/* Three-dot options button */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              id="options-menu-btn"
              className="tap-scale"
              onClick={() => setShowOptionsMenu((v) => !v)}
              aria-label="More options"
              aria-expanded={showOptionsMenu}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: showOptionsMenu ? "var(--accent-bg)" : "var(--tag-bg)",
                border: `1px solid ${showOptionsMenu ? "var(--accent)" : "var(--border)"}`,
                color: showOptionsMenu ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                lineHeight: 1,
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
                letterSpacing: "0px",
              }}
            >
              ⋮
            </button>

            {/* Options dropdown */}
            {showOptionsMenu && (
              <>
                <div
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowColorPicker(false);
                  }}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <div
                  className="anim-fade-up"
                  style={{
                    position: "absolute",
                    top: "48px",
                    right: 0,
                    zIndex: 41,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                    minWidth: "220px",
                    overflow: "hidden",
                  }}
                >
                  {/* Theme Mode Toggle Item */}
                  <button
                    className="tap-scale"
                    onClick={() => {
                      toggleMode();
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>{mode === "light" ? "🌙" : "☀️"}</span>
                      <span>{mode === "light" ? "Dark Mode" : "Light Mode"}</span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        borderRadius: "100px",
                        background: "var(--tag-bg)",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                        textTransform: "capitalize",
                      }}
                    >
                      {mode}
                    </span>
                  </button>

                  {/* Theme Accent Color Item / Selector */}
                  <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 16px" }}>
                    <div
                      onClick={() => setShowColorPicker((v) => !v)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px" }}>🎨</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          Theme Color
                        </span>
                      </div>
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "var(--accent)",
                          boxShadow: "0 0 6px var(--accent-glow)",
                          border: "1.5px solid var(--bg-card)",
                        }}
                      />
                    </div>

                    {/* Color Presets Palette */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginTop: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      {Object.values(THEME_COLOR_PRESETS).map((preset) => {
                        const isSelected = colorId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => setColorId(preset.id)}
                            className="tap-scale"
                            title={preset.name}
                            aria-label={`Select ${preset.name} theme color`}
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              background: preset.primary,
                              border: isSelected ? "2.5px solid var(--text-primary)" : "2px solid transparent",
                              boxShadow: isSelected ? `0 0 8px ${preset.glow}` : "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              transition: "transform 0.15s ease, border 0.15s ease",
                            }}
                          >
                            {isSelected && (
                              <span style={{ color: "#fff", fontSize: "11px", fontWeight: 900, lineHeight: 1 }}>
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Standard Menu Items */}
                  {[
                    { icon: "📋", label: "My Orders", action: () => { setShowOptionsMenu(false); router.push(user ? "/orders" : "/auth"); } },
                    { icon: "🪑", label: `Table ${tableInfo?.tableNumber ?? "—"}`, action: () => setShowOptionsMenu(false) },
                    { icon: "👤", label: user ? user.fullName : "Sign In", action: () => { setShowOptionsMenu(false); router.push(user ? "/orders" : "/auth"); } },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      className="tap-scale"
                      onClick={opt.action}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 16px",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        fontSize: "0.88rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Children (Category Pills Strip) */}
        {children}
      </header>
    </>
  );
}
