"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "@/lib/i18n";
import { getStoredLocale, usePreferences } from "@/components/providers";
export default function DemoPage() {
  const router = useRouter(); const { t } = usePreferences(); const started = useRef(false); const [error, setError] = useState("");
  useEffect(() => { if (started.current) return; started.current = true; fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: getStoredLocale() }) }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || translate(getStoredLocale(), "تعذر إنشاء العرض التجريبي", "Unable to create demo")); router.replace("/app"); }).catch((e: Error) => setError(e.message)); }, [router]);
  return <main className="demo-start" style={{ minHeight: "100dvh", display: "grid", placeContent: "center", gap: "1rem", textAlign: "center", padding: "2rem" }}><span style={{ fontSize: "3rem", color: "var(--green)", fontWeight: 700 }}>m·</span><h1>{t("مساحة لتجربة التوازن", "A little space to find your balance")}</h1><p role={error ? "alert" : "status"}>{error || t("نجهّز مساحة تجريبية خاصة ببيانات توضيحية…", "Preparing your private workspace with sample data…")}</p>{error && <Link className="btn btn-secondary" href="/">{t("العودة للرئيسية", "Back to home")}</Link>}</main>;
}
