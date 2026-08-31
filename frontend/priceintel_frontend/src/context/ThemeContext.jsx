// src/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

/**
 * Supported theme values: "light" | "dark" | "system"
 * "system" follows the OS prefers-color-scheme media query.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("priceintel_theme") || "light";
  });

  // Resolve the actual applied theme (light or dark) considering "system"
  const getResolvedTheme = (t) => {
    if (t === "system") {
      // System preference defaults to light
      return "light";
    }
    return t;
  };

  const applyTheme = (t) => {
    const resolved = getResolvedTheme(t);
    document.documentElement.setAttribute("data-theme", resolved);
  };

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("priceintel_theme", theme);
  }, [theme]);

  // Listen for OS-level changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const resolvedTheme = getResolvedTheme(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "light",
      setTheme: () => {},
      resolvedTheme: "light",
    };
  }
  return ctx;
}
