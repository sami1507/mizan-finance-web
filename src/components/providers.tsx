"use client";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/contracts";
import { createTranslator, isLocale, isRtl, translate, type Translator } from "@/lib/i18n";
type Theme = "light" | "dark";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); window.addEventListener("storage", fn); return () => { listeners.delete(fn); window.removeEventListener("storage", fn); }; };
function getPreference(key: string, fallback: string) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private browsing can disable storage. */ } listeners.forEach((fn) => fn()); }
export function getStoredLocale(): Locale { const value = getPreference("mizan-locale", "ar"); return isLocale(value) ? value : "ar"; }
export function hasStoredLocale(): boolean { return isLocale(getPreference("mizan-locale", "")); }
function localeCookie(value: Locale) { document.cookie = `mizan-locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; }
const setLocale = (value: Locale) => { if (!isLocale(value)) return; localeCookie(value); save("mizan-locale", value); };
const setTheme = (value: Theme) => save("mizan-theme", value);
const Context = createContext<{ locale: Locale; theme: Theme; setLocale: (v: Locale) => void; setTheme: (v: Theme) => void; t: Translator } | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const locale = useSyncExternalStore(subscribe, getStoredLocale, () => "ar") as Locale;
  const theme = useSyncExternalStore(subscribe, () => getPreference("mizan-theme", "light") === "dark" ? "dark" : "light", () => "light") as Theme;
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr"; document.documentElement.dataset.theme = theme; document.title = translate(locale, "ميزان | Mizan Finance", "Mizan Finance — Personal finance"); localeCookie(locale); }, [locale, theme, pathname]);
  return <Context.Provider value={{ locale, theme, setLocale, setTheme, t: createTranslator(locale) }}>{children}</Context.Provider>;
}
export function usePreferences() { const value = useContext(Context); if (!value) throw new Error("Preferences provider missing"); return value; }
