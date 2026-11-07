import type { Locale } from "./contracts";
import { commonMessages } from "./locales/common";
import { financeMessages } from "./locales/finance";
import { analysisMessages } from "./locales/analysis";

export const localeOptions: { value: Locale; label: string }[] = [
  { value: "ar", label: "العربية" }, { value: "en", label: "English" },
  { value: "he", label: "עברית" }, { value: "de", label: "Deutsch" },
];
export const isLocale = (value: string): value is Locale => localeOptions.some(option => option.value === value);
export const isRtl = (locale: Locale) => locale === "ar" || locale === "he";
export const localeTag = (locale: Locale) => ({ ar: "ar-IL", en: "en-IL", he: "he-IL", de: "de-DE" })[locale];
export type MessageValues = Record<string, string | number>;
export type Translator = (arabic: string, english: string, values?: MessageValues) => string;
export const messages: Record<string, { he: string; de: string }> = { ...commonMessages, ...financeMessages, ...analysisMessages };

export function translate(locale: Locale, arabic: string, english: string, values: MessageValues = {}): string {
  const template = locale === "ar" ? arabic : locale === "en" ? english : messages[english]?.[locale] ?? english;
  return template.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
export function createTranslator(locale: Locale): Translator {
  return (arabic, english, values) => translate(locale, arabic, english, values);
}
