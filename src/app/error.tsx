"use client";
import { usePreferences } from "@/components/providers";
export default function ErrorPage({ reset }: { reset: () => void }) { const { t } = usePreferences(); return <main className="error-page"><span>!</span><h1>{t("تعذر تحميل هذه الصفحة.", "Something interrupted this page.")}</h1><p>{t("حاول مجددًا للعودة إلى مساحتك المالية.", "Please try again to return to your workspace.")}</p><button className="btn btn-primary" onClick={reset}>{t("إعادة المحاولة", "Try again")}</button></main>; }
