"use client";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/contracts";
type Theme = "light" | "dark";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); window.addEventListener("storage", fn); return () => { listeners.delete(fn); window.removeEventListener("storage", fn); }; };
function getPreference(key: string, fallback: string) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private browsing can disable storage. */ } listeners.forEach((fn) => fn()); }
export function getStoredLocale(): Locale { return getPreference("mizan-locale", "ar") === "en" ? "en" : "ar"; }
export function hasStoredLocale(): boolean { return ["ar", "en"].includes(getPreference("mizan-locale", "")); }
const setLocale = (value: Locale) => save("mizan-locale", value);
const setTheme = (value: Theme) => save("mizan-theme", value);
const Context = createContext<{ locale: Locale; theme: Theme; setLocale: (v: Locale) => void; setTheme: (v: Theme) => void; t: (ar: string, en: string) => string } | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const locale = useSyncExternalStore(subscribe, getStoredLocale, () => "ar") as Locale;
  const theme = useSyncExternalStore(subscribe, () => getPreference("mizan-theme", "light") === "dark" ? "dark" : "light", () => "light") as Theme;
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; document.documentElement.dataset.theme = theme; document.title = locale === "ar" ? "Mizan Finance | ميزان — أموالك، في توازن" : "Mizan Finance — Money made clear. Life in balance."; }, [locale, theme, pathname]);
  return <Context.Provider value={{ locale, theme, setLocale, setTheme, t: (ar, en) => locale === "ar" ? ar : en }}>{children}</Context.Provider>;
}
export function usePreferences() { const value = useContext(Context); if (!value) throw new Error("Preferences provider missing"); return value; }
