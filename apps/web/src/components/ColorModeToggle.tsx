"use client";

import { useEffect, useState } from "react";

export type ColorMode = "light" | "dark";

export function useColorMode(storageKey: string) {
  const [mode, setMode] = useState<ColorMode>("light");
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setMode(saved === "dark" || saved === "light" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, [storageKey]);
  const toggle = () => setMode((current) => {
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem(storageKey, next);
    return next;
  });
  return { mode, toggle };
}

export function ColorModeToggle({ mode, onToggle, className = "" }: { mode: ColorMode; onToggle: () => void; className?: string }) {
  return <button type="button" onClick={onToggle} aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`} className={`min-h-12 rounded-[4px] border px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}><span aria-hidden="true">{mode === "light" ? "☾" : "☀"}</span> {mode === "light" ? "Dark" : "Light"}</button>;
}
