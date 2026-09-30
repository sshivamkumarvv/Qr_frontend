"use client";

import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Register Service Worker in production / supported environments
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      });
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user dismissed recently
      const dismissed = sessionStorage.getItem("pwa_install_dismissed");
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("[PWA] User accepted the install prompt");
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("pwa_install_dismissed", "true");
  };

  if (!showInstallBanner) return null;

  return (
    <aside
      aria-label="Install App"
      style={{
        position: "fixed",
        bottom: "84px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "calc(100% - 32px)",
        maxWidth: "420px",
        background: "rgba(15, 23, 42, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 87, 34, 0.35)",
        borderRadius: "16px",
        padding: "12px 14px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        animation: "pwaSlideUp 0.3s ease-out forwards",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <img
          src="/icons/icon-192x192.png"
          alt="DineIn Logo"
          width={38}
          height={38}
          style={{ borderRadius: "10px", flexShrink: 0 }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>
            Install DineIn App
          </span>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
            Add to home screen for fast ordering
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button
          onClick={handleInstallClick}
          style={{
            background: "linear-gradient(135deg, #ff5722, #ea580c)",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "7px 12px",
            fontSize: "0.75rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(255, 87, 34, 0.3)",
          }}
        >
          <Download size={13} />
          Install
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            padding: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <style jsx>{`
        @keyframes pwaSlideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </aside>
  );
}
