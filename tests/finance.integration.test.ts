import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closeDb, getDb } from "@/server/db";
import { user } from "@/server/schema";
import { deleteUserData, getSnapshot, mutateFinance } from "@/server/finance-service";
import type { Snapshot } from "@/lib/contracts";

const userA = randomUUID();
const userB = randomUUID();
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const futureDate = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10);

async function state(id = userA): Promise<Snapshot> {
  return getSnapshot(id);
}

async function mutate(action: string, payload: Record<string, unknown>, id = userA) {
  return mutateFinance(id, { action, ...payload });
}

beforeAll(async () => {
  const db = await getDb();
  for (const id of [userA, userB]) {
    await db.insert(user).values({
      id, name: "Integration test", email: `${id}@example.test`,
      emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
    });
  }
  await mutate("onboarding", {
    name: "Integration test", locale: "en", currency: "ILS", timezone: "Asia/Jerusalem",
    accountName: "Primary", accountType: "bank", openingBalance: 500_000,
  });
  await mutate("onboarding", {
    name: "Other owner", locale: "ar", currency: "ILS", timezone: "Asia/Jerusalem",
    accountName: "Private", accountType: "cash", openingBalance: 100_000,
  }, userB);
});

afterAll(async () => {
  await closeDb();
});

describe("financial data integrity against PostgreSQL (PGlite)", () => {
  it("computes 5,000 + 2,000 − 300 = 6,700 in integer minor units", async () => {
    const s = await state();
    const accountId = s.accounts[0].id;
    await mutate("transaction.create", {
      accountId, categoryId: s.categories.find(c => c.kind === "income")!.id,
      kind: "income", amount: 200_000, currency: "ILS", date: today, note: "Salary",
    });
    await mutate("transaction.create", {
      accountId, categoryId: s.categories.find(c => c.kind === "expense")!.id,
      kind: "expense", amount: 30_000, currency: "ILS", date: today, note: "Groceries",
    });
    const result = await state();
    expect(result.accounts[0].balance).toBe(670_000);
    expect(result.transactions.every(t => Number.isSafeInteger(t.amount))).toBe(true);
  });

  it("updates and deletes transactions without leaving stale balances", async () => {
    const s = await state();
    const expense = s.transactions.find(t => t.note === "Groceries")!;
    await mutate("transaction.update", { ...expense, amount: 40_000 });
    expect((await state()).accounts[0].balance).toBe(660_000);
    await mutate("transaction.delete", { id: expense.id });
    expect((await state()).accounts[0].balance).toBe(700_000);
    expect((await state()).transactions.some(t => t.id === expense.id)).toBe(false);
  });

  it("moves money atomically without counting internal transfers as income or expenses", async () => {
    await mutate("account.create", { name: "Cash", type: "cash", currency: "ILS", openingBalance: 0 });
    const s = await state();
    const source = s.accounts.find(a => a.name === "Primary")!;
    const target = s.accounts.find(a => a.name === "Cash")!;
    const before = s.accounts.reduce((sum, a) => sum + a.balance, 0);
    await mutate("transfer.create", { fromAccountId: source.id, toAccountId: target.id, amount: 12_345, date: today, note: "ATM" });
    const result = await state();
    expect(result.accounts.reduce((sum, a) => sum + a.balance, 0)).toBe(before);
    expect(result.accounts.find(a => a.id === source.id)!.balance).toBe(source.balance - 12_345);
    expect(result.accounts.find(a => a.id === target.id)!.balance).toBe(target.balance + 12_345);
    expect(result.transactions).toHaveLength(s.transactions.length);
  });

  it("rejects cross-currency transfers without modifying balances", async () => {
    await mutate("account.create", { name: "USD wallet", type: "wallet", currency: "USD", openingBalance: 20_000 });
    const s = await state();
    await expect(mutate("transfer.create", {
      fromAccountId: s.accounts.find(a => a.currency === "ILS")!.id,
      toAccountId: s.accounts.find(a => a.currency === "USD")!.id,
      amount: 10_000, date: today, note: "Invalid FX",
    })).rejects.toThrow();
    expect((await state()).accounts.map(a => a.balance)).toEqual(s.accounts.map(a => a.balance));
  });

  it("keeps goal allocation separate from spending and total balance", async () => {
    await mutate("goal.create", { name: "Emergency fund", target: 100_000, currency: "ILS", deadline: futureDate });
    const s = await state();
    const goal = s.goals.find(g => g.name === "Emergency fund")!;
    await mutate("contribution.create", { goalId: goal.id, accountId: s.accounts.find(a => a.currency === "ILS")!.id, amount: 5_000, date: today });
    const result = await state();
    expect(result.goals.find(g => g.id === goal.id)!.saved).toBe(5_000);
    expect(result.accounts.map(a => a.balance)).toEqual(s.accounts.map(a => a.balance));
    expect(result.transactions).toHaveLength(s.transactions.length);
  });

  it("derives the budget from matching category, currency and month", async () => {
    const s = await state();
    const categoryId = s.categories.find(c => c.kind === "expense")!.id;
    const accountId = s.accounts.find(a => a.currency === "ILS")!.id;
    await mutate("budget.save", { categoryId, month, amount: 20_000, currency: "ILS" });
    await mutate("transaction.create", { accountId, categoryId, kind: "expense", amount: 10_001, currency: "ILS", date: today, note: "Budget expense" });
    const budget = (await state()).budgets.find(b => b.categoryId === categoryId && b.month === month)!;
    expect(budget.spent).toBe(10_001);
    expect(budget.amount).toBe(20_000);
  });

  it("rejects invalid money, date, account currency and category kind", async () => {
    const s = await state();
    const row = { accountId: s.accounts.find(a => a.currency === "ILS")!.id, categoryId: s.categories.find(c => c.kind === "expense")!.id, kind: "expense", amount: 100, currency: "ILS", date: today, note: "invalid" };
    for (const bad of [{ amount: 0 }, { amount: -100 }, { amount: 1.25 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { date: "2026-02-30" }, { currency: "EUR" }, { kind: "income" }]) {
      await expect(mutate("transaction.create", { ...row, ...bad })).rejects.toThrow();
    }
    expect((await state()).transactions).toHaveLength(s.transactions.length);
  });

  it("prevents another owner reading or mutating linked entities", async () => {
    const a = await state();
    const b = await state(userB);
    expect(b.accounts.some(x => a.accounts.some(y => x.id === y.id))).toBe(false);
    expect(b.transactions).toHaveLength(0);
    const tx = a.transactions[0];
    await expect(mutate("transaction.update", { ...tx, amount: 5_000 }, userB)).rejects.toThrow();
    await expect(mutate("transaction.delete", { id: tx.id }, userB)).rejects.toThrow();
    await expect(mutate("transaction.create", { ...tx, id: undefined }, userB)).rejects.toThrow();
    await expect(mutate("transfer.create", { fromAccountId: a.accounts[0].id, toAccountId: b.accounts[0].id, amount: 100, date: today, note: "Forbidden" }, userB)).rejects.toThrow();
    await expect(mutate("contribution.create", { goalId: a.goals[0].id, accountId: b.accounts[0].id, amount: 100, date: today }, userB)).rejects.toThrow();
    expect((await state()).accounts.map(x => x.balance)).toEqual(a.accounts.map(x => x.balance));
  });

  it("imports atomically and does not insert the same CSV row twice", async () => {
    const s = await state();
    const row = { accountId: s.accounts.find(a => a.currency === "ILS")!.id, categoryId: s.categories.find(c => c.kind === "expense")!.id, kind: "expense", amount: 789, currency: "ILS", date: today, note: "Unique CSV import" };
    await mutate("import.commit", { rows: [row, row] });
    await Promise.all([mutate("import.commit", { rows: [row] }), mutate("import.commit", { rows: [row] })]);
    expect((await state()).transactions.filter(t => t.note === row.note)).toHaveLength(1);
    const before = await state();
    await expect(mutate("import.commit", { rows: [{ ...row, note: "Should roll back" }, { ...row, amount: -5 }] })).rejects.toThrow();
    expect((await state()).transactions).toHaveLength(before.transactions.length);
    const imported = before.transactions.find(t => t.note === row.note)!;
    await mutate("transaction.delete", { id: imported.id });
    await mutate("import.commit", { rows: [row] });
    expect((await state()).transactions.some(t => t.note === row.note)).toBe(false);
  });

  it("records due recurring items exactly once and leaves future items scheduled", async () => {
    const s = await state();
    const base = { accountId: s.accounts.find(a => a.currency === "ILS")!.id, categoryId: s.categories.find(c => c.kind === "expense")!.id, kind: "expense", amount: 2_999, currency: "ILS", frequency: "monthly", active: true };
    await mutate("recurring.create", { ...base, name: "Due subscription", nextDate: today });
    await mutate("recurring.create", { ...base, name: "Future subscription", nextDate: "2099-01-01" });
    const before = (await state()).transactions.length;
    await Promise.all([mutate("recurring.process", {}), mutate("recurring.process", {})]);
    await mutate("recurring.process", {});
    const after = await state();
    expect(after.transactions).toHaveLength(before + 1);
    expect(after.recurring.find(r => r.name === "Due subscription")!.nextDate > today).toBe(true);
    expect(after.recurring.find(r => r.name === "Future subscription")!.nextDate).toBe("2099-01-01");
  });

  it("pauses recurring items and keeps one user deletion isolated", async () => {
    const s = await state();
    const due = s.recurring.find(r => r.name === "Due subscription")!;
    await mutate("recurring.update", { ...due, nextDate: today, active: false });
    await mutate("recurring.create", { ...due, id: undefined, name: "Never posted paused subscription", nextDate: today, active: false });
    await mutate("recurring.process", {});
    expect((await state()).transactions).toHaveLength(s.transactions.length);
    await deleteUserData(userB);
    expect((await state()).accounts.map(a => a.balance)).toEqual(s.accounts.map(a => a.balance));
  });
});
