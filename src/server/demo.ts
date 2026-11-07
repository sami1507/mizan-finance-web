import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "./schema";
import { ensureProfile, deleteUserData } from "./finance-service";
import { hashToken } from "./http";
import { localDate } from "../lib/finance";
import type { Locale } from "../lib/contracts";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const demoName: Record<Locale, string> = { ar: "سارة", en: "Sara", he: "שרה", de: "Sara" };
export async function seedDemoData(userId: string, locale: Locale = "ar") {
  const db = await getDb();
  const [owner] = await db.select({ demo: s.user.demo }).from(s.user).where(eq(s.user.id, userId));
  if (!owner?.demo) throw new Error("Sample data can only be created for a demo user.");
  await ensureProfile(userId);
  const text = (ar: string, en: string, he: string, de: string) => ({ ar, en, he, de })[locale];
  await db.transaction(async tx => {
    await tx.select().from(s.user).where(eq(s.user.id, userId)).for("update");
    if ((await tx.select().from(s.financialAccounts).where(eq(s.financialAccounts.userId, userId))).length) return;
    const bank = randomUUID(), savings = randomUUID(), cash = randomUUID(), usd = randomUUID();
    const now = new Date(`${localDate()}T12:00:00Z`);
    const year = now.getUTCFullYear(), month = now.getUTCMonth();
    const thisMonth = iso(now).slice(0, 7);
    const category = (slug: string) => `${userId}:${slug}`;
    await tx.update(s.user).set({ name: demoName[locale] }).where(eq(s.user.id, userId));
    await tx.update(s.profiles).set({ onboarded: true, locale }).where(eq(s.profiles.userId, userId));
    await tx.insert(s.financialAccounts).values([
      { id: bank, userId, name: text("الحساب الرئيسي", "Main account", "חשבון ראשי", "Hauptkonto"), type: "bank", currency: "ILS", openingBalance: 420000 },
      { id: savings, userId, name: text("حساب الادخار", "Savings account", "חשבון חיסכון", "Sparkonto"), type: "bank", currency: "ILS", openingBalance: 800000 },
      { id: cash, userId, name: text("محفظتي", "My wallet", "הארנק שלי", "Mein Bargeld"), type: "cash", currency: "ILS", openingBalance: 65000 },
      { id: usd, userId, name: text("محفظة الدولار", "USD wallet", "ארנק בדולר", "USD-Wallet"), type: "wallet", currency: "USD", openingBalance: 125000 },
    ]);
    const transactions: (typeof s.transactions.$inferInsert)[] = [];
    const add = (offset: number, day: number, kind: "income" | "expense", amount: number, slug: string, note: string) => {
      const date = iso(new Date(Date.UTC(year, month + offset, Math.min(day, offset === 0 ? now.getUTCDate() : 28), 12)));
      transactions.push({ id: randomUUID(), userId, accountId: bank, categoryId: category(slug), kind, amount, currency: "ILS", date, note });
    };
    for (let offset = -5; offset <= 0; offset++) {
      add(offset, 1, "income", 850000, "salary", text("الراتب الشهري", "Monthly salary", "משכורת חודשית", "Monatsgehalt"));
      add(offset, 3, "income", 120000 + (offset + 5) * 15000, "freelance", text("مشروع تصميم", "Design project", "פרויקט עיצוב", "Designprojekt"));
      add(offset, 2, "expense", 280000, "housing", text("إيجار المنزل", "Home rent", "שכר דירה", "Wohnungsmiete"));
      add(offset, 4, "expense", 78000 + (offset + 5) * 3000, "groceries", text("مشتريات المنزل", "Household groceries", "קניות לבית", "Lebensmitteleinkauf"));
      add(offset, 6, "expense", 34000 + (offset + 5) * 5000, "dining", text("مطاعم وقهوة", "Dining and coffee", "מסעדות וקפה", "Restaurants und Kaffee"));
      add(offset, 9, "expense", 38000, "transport", text("تنقلات الشهر", "Monthly transport", "תחבורה חודשית", "Monatliche Fahrtkosten"));
      add(offset, 12, "expense", 5900, "subscriptions", text("اشتراك الموسيقى", "Music subscription", "מינוי מוזיקה", "Musikabo"));
      add(offset, 17, "expense", 28000 + (offset + 5) * 2000, "shopping", text("مشتريات شخصية", "Personal shopping", "קניות אישיות", "Persönliche Einkäufe"));
      if (offset < 0) add(offset, 21, "expense", 19500, "health", text("عناية وصحة", "Health and care", "בריאות וטיפוח", "Gesundheit und Pflege"));
    }
    await tx.insert(s.transactions).values(transactions);
    await tx.insert(s.transfers).values({ id: randomUUID(), userId, fromAccountId: bank, toAccountId: savings, amount: 100000, date: iso(now), note: text("إضافة إلى حساب الادخار", "Transfer to savings", "העברה לחיסכון", "Überweisung auf das Sparkonto") });
    await tx.insert(s.budgets).values([
      { id: randomUUID(), userId, categoryId: category("groceries"), month: thisMonth, amount: 150000, currency: "ILS" },
      { id: randomUUID(), userId, categoryId: category("dining"), month: thisMonth, amount: 70000, currency: "ILS" },
      { id: randomUUID(), userId, categoryId: category("shopping"), month: thisMonth, amount: 100000, currency: "ILS" },
      { id: randomUUID(), userId, categoryId: category("transport"), month: thisMonth, amount: 50000, currency: "ILS" },
    ]);
    const emergency = randomUUID(), travel = randomUUID();
    await tx.insert(s.goals).values([
      { id: emergency, userId, name: text("صندوق الطوارئ", "Emergency fund", "קרן חירום", "Notgroschen"), target: 1500000, currency: "ILS", deadline: iso(new Date(Date.UTC(year + 1, month, 1))) },
      { id: travel, userId, name: text("رحلة الصيف", "Summer trip", "חופשת קיץ", "Sommerreise"), target: 800000, currency: "ILS", deadline: iso(new Date(Date.UTC(year + 1, 5, 1))) },
    ]);
    await tx.insert(s.contributions).values([
      { id: randomUUID(), userId, goalId: emergency, accountId: savings, amount: 650000, date: iso(now) },
      { id: randomUUID(), userId, goalId: travel, accountId: savings, amount: 180000, date: iso(now) },
    ]);
    const next = (days: number) => iso(new Date(now.getTime() + days * 86400000));
    await tx.insert(s.recurring).values([
      { id: randomUUID(), userId, name: text("اشتراك الإنترنت", "Internet subscription", "מינוי אינטרנט", "Internetabo"), accountId: bank, categoryId: category("subscriptions"), kind: "expense", amount: 12000, currency: "ILS", frequency: "monthly", nextDate: next(3), active: true },
      { id: randomUUID(), userId, name: text("النادي الرياضي", "Gym membership", "מינוי לחדר כושר", "Fitnessstudio"), accountId: bank, categoryId: category("health"), kind: "expense", amount: 18000, currency: "ILS", frequency: "monthly", nextDate: next(7), active: true },
      { id: randomUUID(), userId, name: text("الراتب الشهري", "Monthly salary", "משכורת חודשית", "Monatsgehalt"), accountId: bank, categoryId: category("salary"), kind: "income", amount: 850000, currency: "ILS", frequency: "monthly", nextDate: iso(new Date(Date.UTC(year, month + 1, 1))), active: true },
    ]);
    await tx.insert(s.notes).values({ id: randomUUID(), userId, title: text("خطتي لهذا الشهر", "My plan this month", "התוכנית שלי לחודש הזה", "Mein Plan für diesen Monat"), body: text("تخصيص مبلغ ثابت للطوارئ، ومراجعة الاشتراكات قبل موعد تجديدها. هذه ملاحظة تجريبية قابلة للحذف.", "Set aside a fixed amount for emergencies and review subscriptions before they renew. You can delete this sample note.", "להקצות סכום קבוע למקרי חירום ולבדוק מינויים לפני חידושם. אפשר למחוק את הערת ההדגמה הזו.", "Einen festen Betrag für Notfälle zurücklegen und Abonnements vor der Verlängerung prüfen. Diese Beispielnotiz kann gelöscht werden.") });
  });
}

export async function createDemo(locale: Locale = "ar"): Promise<{ token: string; userId: string }> {
  const db = await getDb();
  const userId = randomUUID(), token = randomBytes(32).toString("base64url");
  await db.insert(s.user).values({ id: userId, name: demoName[locale], email: `demo-${userId}@example.invalid`, demo: true, emailVerified: false });
  try {
    await seedDemoData(userId, locale);
    await db.insert(s.demoSessions).values({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 86400000) });
  } catch (error) { await deleteUserData(userId); throw error; }
  return { token, userId };
}
export async function cleanExpiredDemos() {
  const db = await getDb();
  const expired = await db.select({ id: s.user.id }).from(s.user).where(and(eq(s.user.demo, true), lt(s.user.createdAt, new Date(Date.now() - 86400000))));
  for (const demo of expired) await deleteUserData(demo.id);
  return expired.length;
}
