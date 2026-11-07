"use client";
import Link from "next/link";
import { usePreferences } from "./providers";
export function Brand({ light = false }: { light?: boolean }) {
  const { t } = usePreferences();
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label={t("ميزان — الرئيسية", "Mizan Finance — Home")}><span className="brand-mark">m<span>·</span></span><span className="brand-word">{t("ميزان", "mizan")}<small>MIZAN FINANCE</small></span></Link>;
}
