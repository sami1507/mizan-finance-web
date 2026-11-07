"use client";
import { Globe2 } from "lucide-react";
import { isLocale, localeOptions } from "@/lib/i18n";
import { usePreferences } from "./providers";

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = usePreferences();
  return <label className={compact ? "language-select compact" : "form-field language-select"}>
    {compact && <Globe2 size={16} aria-hidden="true" />}
    <span className={compact ? "sr-only" : undefined}>{t("اللغة", "Language")}</span>
    <select data-testid="language-select" value={locale} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>
      {localeOptions.map(option => <option key={option.value} value={option.value} lang={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
