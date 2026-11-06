"use client";
import Link from "next/link";
import { usePreferences } from "@/components/providers";
export default function NotFound() { const { t } = usePreferences(); return <main className="error-page"><span>404</span><h1>{t("يبدو أننا خرجنا عن المسار.", "A little off balance.")}</h1><p>{t("هذه الصفحة غير موجودة. لنعد إلى مكان أوضح.", "This page doesn’t exist. Let’s get you back on track.")}</p><Link className="btn btn-primary" href="/">{t("العودة للرئيسية", "Back to home")}</Link></main>; }
