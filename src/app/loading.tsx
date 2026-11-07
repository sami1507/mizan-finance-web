"use client";
import { usePreferences } from "@/components/providers";
export default function Loading() { const { t } = usePreferences(); return <div className="page-loading" role="status" aria-label={t("جارٍ التحميل…", "Loading…")}><span className="brand-mark">m<span>·</span></span><i/></div>; }
