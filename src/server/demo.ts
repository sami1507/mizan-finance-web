import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "./schema";
import { ensureProfile, deleteUserData } from "./finance-service";
import { hashToken } from "./http";
import { localDate } from "../lib/finance";

const iso = (date: Date) => date.toISOString().slice(0, 10);
export async function seedDemoData(userId: string) {
  await ensureProfile(userId);
  const db = await getDb();
  await db.transaction(async tx => {
    await tx.select().from(s.user).where(eq(s.user.id, userId)).for("update");
    if ((await tx.select().from(s.financialAccounts).where(eq(s.financialAccounts.userId, userId))).length) return;
    const bank = randomUUID(), savings = randomUUID(), cash = randomUUID(), usd = randomUUID();
    const now = new Date(`${localDate()}T12:00:00Z`);
    const year = now.getUTCFullYear(), month = now.getUTCMonth();
    const thisMonth = iso(now).slice(0, 7);
    const category = (slug: string) => `${userId}:${slug}`;
    await tx.update(s.profiles).set({ onboarded: true }).where(eq(s.profiles.userId, userId));
    await tx.insert(s.financialAccounts).values([
      { id: bank, userId, name: "الحساب الرئيسي", type: "bank", currency: "ILS", openingBalance: 420000 },
      { id: savings, userId, name: "حساب الادخار", type: "bank", currency: "ILS", openingBalance: 800000 },
      { id: cash, userId, name: "محفظتي", type: "cash", currency: "ILS", openingBalance: 65000 },
      { id: usd, userId, name: "USD wallet", type: "wallet", currency: "USD", openingBalance: 125000 },
    ]);
    const transactions: (typeof s.transactions.$inferInsert)[] = [];
    const add = (offset: number, day: number, kind: "income" | "expense", amount: number, slug: string, note: string) => {
      const date = iso(new Date(Date.UTC(year, month + offset, Math.min(day, offset === 0 ? now.getUTCDate() : 28), 12)));
      transactions.push({ id: randomUUID(), userId, accountId: bank, categoryId: category(slug), kind, amount, currency: "ILS", date, note });
    };
    for (let offset = -5; offset <= 0; offset++) {
      add(offset, 1, "income", 850000, "salary", "الراتب الشهري");
      add(offset, 3, "income", 120000 + (offset + 5) * 15000, "freelance", "مشروع تصميم");
      add(offset, 2, "expense", 280000, "housing", "إيجار المنزل");
      add(offset, 4, "expense", 78000 + (offset + 5) * 3000, "groceries", "مشتريات المنزل");
      add(offset, 6, "expense", 34000 + (offset + 5) * 5000, "dining", "مطاعم وقهوة");
      add(offset, 9, "expense", 38000, "transport", "تنقلات الشهر");
      add(offset, 12, "expense", 5900, "subscriptions", "اشتراك الموسيقى");
      add(offset, 17, "expense", 28000 + (offset + 5) * 2000, "shopping", "مشتريات شخصية");
      if (offset < 0) add(offset, 21, "expense", 19500, "health", "عناية وصحة");
    }
    await tx.insert(s.transactions).values(transactions);
    await tx.insert(s.transfers).values({ id: randomUUID(), userId, fromAccountId: bank, toAccountId: savings, amount: 100000, date: iso(now), note: "إضافة إلى حساب الادخار" });
    await tx.insert(s.budgets).values([
      { id: randomUUID(), userId, categoryId: category("groceries"), month: thisMonth, amount: 150000, currency: "ILS" },
      { id: randomUUID(), userId, categoryId: category("dining"), month: thisMonth, amount: 70000, currency: "ILS" },
      { id: randomUUID(), userId, categoryId: category("shopping"), month: thisMonth, amount: 100000, currency: "ILS" },
      { id: randomUUID(), userId, categoryId: category("transport"), month: thisMonth, amount: 50000, currency: "ILS" },
    ]);
    const emergency = randomUUID(), travel = randomUUID();
    await tx.insert(s.goals).values([
      { id: emergency, userId, name: "صندوق الطوارئ", target: 1500000, currency: "ILS", deadline: iso(new Date(Date.UTC(year + 1, month, 1))) },
      { id: travel, userId, name: "رحلة الصيف", target: 800000, currency: "ILS", deadline: iso(new Date(Date.UTC(year + 1, 5, 1))) },
    ]);
    await tx.insert(s.contributions).values([
      { id: randomUUID(), userId, goalId: emergency, accountId: savings, amount: 650000, date: iso(now) },
      { id: randomUUID(), userId, goalId: travel, accountId: savings, amount: 180000, date: iso(now) },
    ]);
    const next = (days: number) => iso(new Date(now.getTime() + days * 86400000));
    await tx.insert(s.recurring).values([
      { id: randomUUID(), userId, name: "اشتراك الإنترنت", accountId: bank, categoryId: category("subscriptions"), kind: "expense", amount: 12000, currency: "ILS", frequency: "monthly", nextDate: next(3), active: true },
      { id: randomUUID(), userId, name: "النادي الرياضي", accountId: bank, categoryId: category("health"), kind: "expense", amount: 18000, currency: "ILS", frequency: "monthly", nextDate: next(7), active: true },
      { id: randomUUID(), userId, name: "الراتب الشهري", accountId: bank, categoryId: category("salary"), kind: "income", amount: 850000, currency: "ILS", frequency: "monthly", nextDate: iso(new Date(Date.UTC(year, month + 1, 1))), active: true },
    ]);
    await tx.insert(s.notes).values({ id: randomUUID(), userId, title: "خطتي لهذا الشهر", body: "تخصيص مبلغ ثابت للطوارئ، ومراجعة الاشتراكات قبل موعد تجديدها. هذه ملاحظة تجريبية قابلة للحذف." });
  });
}

export async function createDemo(): Promise<{ token: string; userId: string }> {
  const db = await getDb();
  const userId = randomUUID(), token = randomBytes(32).toString("base64url");
  await db.insert(s.user).values({ id: userId, name: "سارة", email: `demo-${userId}@example.invalid`, demo: true, emailVerified: false });
  try {
    await seedDemoData(userId);
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
