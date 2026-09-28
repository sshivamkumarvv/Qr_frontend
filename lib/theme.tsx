"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark";

export interface ColorPreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  glow: string;
  bg: string;
  border: string;
}

export const THEME_COLOR_PRESETS: Record<string, ColorPreset> = {
  orange: {
    id: "orange",
    name: "Sunset Orange",
    primary: "#ff5722",
    secondary: "#ff8c3b",
    glow: "rgba(255, 87, 34, 0.3)",
    bg: "rgba(255, 87, 34, 0.1)",
    border: "rgba(255, 87, 34, 0.28)",
  },
  emerald: {
    id: "emerald",
    name: "Fresh Emerald",
    primary: "#10b981",
    secondary: "#34d399",
    glow: "rgba(16, 185, 129, 0.3)",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.28)",
  },
  violet: {
    id: "violet",
    name: "Royal Violet",
    primary: "#7c3aed",
    secondary: "#9333ea",
    glow: "rgba(124, 58, 237, 0.3)",
    bg: "rgba(124, 58, 237, 0.1)",
    border: "rgba(124, 58, 237, 0.28)",
  },
  rose: {
    id: "rose",
    name: "Vibrant Rose",
    primary: "#e11d48",
    secondary: "#f43f5e",
    glow: "rgba(225, 29, 72, 0.3)",
    bg: "rgba(225, 29, 72, 0.1)",
    border: "rgba(225, 29, 72, 0.28)",
  },
  blue: {
    id: "blue",
    name: "Ocean Blue",
    primary: "#2563eb",
    secondary: "#3b82f6",
    glow: "rgba(37, 99, 235, 0.3)",
    bg: "rgba(37, 99, 235, 0.1)",
    border: "rgba(37, 99, 235, 0.28)",
  },
  amber: {
    id: "amber",
    name: "Golden Amber",
    primary: "#d97706",
    secondary: "#f59e0b",
    glow: "rgba(217, 119, 6, 0.3)",
    bg: "rgba(217, 119, 6, 0.1)",
    border: "rgba(217, 119, 6, 0.28)",
  },
};

export const DEFAULT_THEME_MODE: ThemeMode = "light";
export const DEFAULT_COLOR_ID = "orange";

const THEME_MODE_KEY = "dinein_theme_mode";
const THEME_COLOR_KEY = "dinein_theme_color";

export function applyTheme(mode: ThemeMode, colorKey: string) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Apply mode
  root.setAttribute("data-theme", mode);

  // Apply colors
  const preset = THEME_COLOR_PRESETS[colorKey] || THEME_COLOR_PRESETS[DEFAULT_COLOR_ID];
  root.style.setProperty("--accent", preset.primary);
  root.style.setProperty("--accent-2", preset.secondary);
  root.style.setProperty("--accent-glow", preset.glow);
  root.style.setProperty("--accent-bg", preset.bg);
  root.style.setProperty("--accent-border", preset.border);

  // Update theme-color meta tag for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", mode === "dark" ? "#0a0a0f" : "#f8f9fc");
  }
}

interface ThemeContextType {
  mode: ThemeMode;
  colorId: string;
  setMode: (mode: ThemeMode) => void;
  setColorId: (colorId: string) => void;
  toggleMode: () => void;
  colorPresets: typeof THEME_COLOR_PRESETS;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: DEFAULT_THEME_MODE,
  colorId: DEFAULT_COLOR_ID,
  setMode: () => {},
  setColorId: () => {},
  toggleMode: () => {},
  colorPresets: THEME_COLOR_PRESETS,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [colorId, setColorIdState] = useState<string>(DEFAULT_COLOR_ID);

  useEffect(() => {
    // Read from localStorage on mount (defaulting to light if unset)
    const savedMode = (localStorage.getItem(THEME_MODE_KEY) as ThemeMode) || DEFAULT_THEME_MODE;
    const savedColor = localStorage.getItem(THEME_COLOR_KEY) || DEFAULT_COLOR_ID;

    setModeState(savedMode);
    setColorIdState(savedColor);
    applyTheme(savedMode, savedColor);
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_MODE_KEY, newMode);
    applyTheme(newMode, colorId);
  }, [colorId]);

  const setColorId = useCallback((newColorId: string) => {
    setColorIdState(newColorId);
    localStorage.setItem(THEME_COLOR_KEY, newColorId);
    applyTheme(mode, newColorId);
  }, [mode]);

  const toggleMode = useCallback(() => {
    const nextMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colorId,
        setMode,
        setColorId,
        toggleMode,
        colorPresets: THEME_COLOR_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
