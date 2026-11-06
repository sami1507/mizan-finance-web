"use client";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Locale } from "@/lib/contracts";
type Theme = "light" | "dark";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); window.addEventListener("storage", fn); return () => { listeners.delete(fn); window.removeEventListener("storage", fn); }; };
function getPreference(key: string, fallback: string) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private browsing can disable storage. */ } listeners.forEach((fn) => fn()); }
const Context = createContext<{ locale: Locale; theme: Theme; setLocale: (v: Locale) => void; setTheme: (v: Theme) => void; t: (ar: string, en: string) => string } | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, () => getPreference("mizan-locale", "ar") === "en" ? "en" : "ar", () => "ar") as Locale;
  const theme = useSyncExternalStore(subscribe, () => getPreference("mizan-theme", "light") === "dark" ? "dark" : "light", () => "light") as Theme;
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; document.documentElement.dataset.theme = theme; }, [locale, theme]);
  return <Context.Provider value={{ locale, theme, setLocale: (v) => save("mizan-locale", v), setTheme: (v) => save("mizan-theme", v), t: (ar, en) => locale === "ar" ? ar : en }}>{children}</Context.Provider>;
}
export function usePreferences() { const value = useContext(Context); if (!value) throw new Error("Preferences provider missing"); return value; }
