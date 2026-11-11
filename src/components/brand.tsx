"use client";
import Link from "next/link";
import { usePreferences } from "./providers";

/** The same outlined mark is used in the downloadable brand assets and app icons. */
export function BrandMark({ className = "" }: { className?: string }) {
  return <svg className={`mizan-mark ${className}`} viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true" focusable="false"><path d="M10 47V28c0-6 3.5-10 8.5-10S27 22 27 28v19M27 28c0-6 3.5-10 8.5-10S44 22 44 28v19" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><circle className="mizan-mark-dot" cx="55" cy="44" r="4"/></svg>;
}

export function Brand({ light = false }: { light?: boolean }) {
  const { t } = usePreferences();
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} title={t("ميزان — الرئيسية", "Mizan Finance — Home")}><BrandMark/><span className="brand-word">{t("ميزان", "mizan")}<small>MIZAN FINANCE</small></span></Link>;
}
