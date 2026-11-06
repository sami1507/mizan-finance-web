import type { Currency, Locale, Snapshot, Transaction } from "@/lib/contracts";
import { exactSum, localDate, parseMoney } from "@/lib/finance";

export const today = (timezone = "Asia/Jerusalem") => localDate(timezone);
export const thisMonth = (timezone = "Asia/Jerusalem") => today(timezone).slice(0, 7);
export function minor(value: string): number {
  try { return parseMoney(value); }
  catch (error) {
    throw new Error(error instanceof Error && error.message.includes("large")
      ? "المبلغ أكبر من الحد المسموح. / Amount exceeds the supported limit."
      : "أدخل مبلغًا صحيحًا بمنزلتين عشريتين كحد أقصى. / Enter an amount with up to two decimal places.");
  }
}
export function major(value: number) { return (value / 100).toFixed(2); }
export function money(value: number, currency: Currency, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-IL" : "en-IL", { style: "currency", currency, maximumFractionDigits: 2 }).format(value / 100);
}
export function dateLabel(value: string, locale: Locale, timezone = "Asia/Jerusalem") {
  // A ledger date is a calendar day, not an instant; do not shift it across time zones.
  const calendarDate = value.length === 10;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: "short", timeZone: calendarDate ? "UTC" : timezone }).format(new Date(calendarDate ? `${value}T12:00:00Z` : value));
}
export function categoryLabel(data: Snapshot, id: string, locale: Locale) {
  const category = data.categories.find((c) => c.id === id);
  return category ? locale === "ar" ? category.nameAr : category.name : "—";
}
export function sum(rows: Transaction[], kind: "income" | "expense") { return exactSum(rows.filter((r) => r.kind === kind).map((r) => r.amount)); }
export function monthlyRows(data: Snapshot, currency: Currency, account = "", months = 6) {
  return Array.from({ length: months }, (_, index) => {
    const d = new Date(`${thisMonth(data.profile.timezone)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (months - index - 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const rows = data.transactions.filter((row) => row.currency === currency && row.date.startsWith(key) && (!account || row.accountId === account));
    return { key, income: sum(rows, "income") / 100, expense: sum(rows, "expense") / 100 };
  });
}
