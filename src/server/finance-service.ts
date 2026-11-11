import { and, eq, desc, asc, or, like } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { getDb, type Database } from "./db";
import * as s from "./schema";
import * as v from "./validation";
import { accountBalance, exactSum, localDate, nextOccurrence } from "../lib/finance";
import type { Snapshot, Currency, Locale, Account, Transaction, Transfer, Recurring } from "../lib/contracts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const categoryDefaults = [
  ["salary", "Salary", "الراتب", "income", "#188875"],
  ["freelance", "Freelance", "عمل حر", "income", "#478aab"],
  ["other-income", "Other income", "دخل آخر", "income", "#8c9a67"],
  ["groceries", "Groceries", "البقالة", "expense", "#0c8575"],
  ["dining", "Dining", "المطاعم", "expense", "#d1a052"],
  ["transport", "Transport", "المواصلات", "expense", "#5a87a5"],
  ["housing", "Housing", "السكن", "expense", "#8c78a5"],
  ["shopping", "Shopping", "التسوق", "expense", "#c8796c"],
  ["health", "Health", "الصحة", "expense", "#71966b"],
  ["subscriptions", "Subscriptions", "الاشتراكات", "expense", "#7187ba"],
  ["education", "Education", "التعليم", "expense", "#b18556"],
  ["other", "Other", "أخرى", "expense", "#88949e"],
] as const;

export async function ensureProfile(userId: string) {
  const db = await getDb();
  const existing = await db.select().from(s.profiles).where(eq(s.profiles.userId, userId));
  if (existing.length) return;
  await db.transaction(async tx => {
    const [owner] = await tx.select().from(s.user).where(eq(s.user.id, userId)).for("update");
    if (!owner) throw new v.ServiceError("Session expired. Please sign in again.", 401);
    await tx.insert(s.profiles).values({ userId }).onConflictDoNothing();
    await tx.insert(s.categories).values(categoryDefaults.map(([slug, name, nameAr, kind, color]) => ({ id: `${userId}:${slug}`, userId, name, nameAr, kind, color }))).onConflictDoNothing();
  });
}

export async function getSnapshot(userId: string): Promise<Snapshot> {
  await ensureProfile(userId);
  const database = await getDb();
  return database.transaction(async db => {
  const [[owner], [profile], accounts, categories, transactions, transfers, budgets, goals, contributions, recurring, notes, processedRecurringEvents] = await Promise.all([
    db.select().from(s.user).where(eq(s.user.id, userId)),
    db.select().from(s.profiles).where(eq(s.profiles.userId, userId)),
    db.select().from(s.financialAccounts).where(eq(s.financialAccounts.userId, userId)).orderBy(asc(s.financialAccounts.name)),
    db.select().from(s.categories).where(eq(s.categories.userId, userId)),
    db.select().from(s.transactions).where(eq(s.transactions.userId, userId)).orderBy(desc(s.transactions.date), desc(s.transactions.id)),
    db.select().from(s.transfers).where(eq(s.transfers.userId, userId)).orderBy(desc(s.transfers.date)),
    db.select().from(s.budgets).where(eq(s.budgets.userId, userId)).orderBy(desc(s.budgets.month)),
    db.select().from(s.goals).where(eq(s.goals.userId, userId)),
    db.select().from(s.contributions).where(eq(s.contributions.userId, userId)),
    db.select().from(s.recurring).where(eq(s.recurring.userId, userId)).orderBy(asc(s.recurring.nextDate)),
    db.select().from(s.notes).where(eq(s.notes.userId, userId)).orderBy(desc(s.notes.createdAt)),
    db.select({ key: s.processedEvents.key }).from(s.processedEvents).where(and(eq(s.processedEvents.userId, userId), like(s.processedEvents.key, "recurring:%"))).orderBy(asc(s.processedEvents.key)),
  ]);
  if (!owner || !profile) throw new v.ServiceError("Session expired. Please sign in again.", 401);
  const cleanTransactions: Transaction[] = transactions.map(({ id, accountId, categoryId, kind, amount, currency, date, note, sourceKey }) => ({ id, accountId, categoryId, kind: kind as Transaction["kind"], amount, currency: currency as Currency, date, note, sourceKey }));
  const cleanTransfers: Transfer[] = transfers.map(({ id, fromAccountId, toAccountId, amount, date, note }) => ({ id, fromAccountId, toAccountId, amount, date, note }));
  return {
    profile: { id: userId, name: owner.name, email: owner.email, locale: profile.locale as Locale, currency: profile.currency as Currency, timezone: profile.timezone, onboarded: profile.onboarded },
    accounts: accounts.map(({ id, name, type, currency, openingBalance }) => ({ id, name, type: type as Account["type"], currency: currency as Currency, openingBalance, balance: accountBalance({ id, openingBalance }, cleanTransactions, cleanTransfers) })),
    categories: categories.map(({ id, name, nameAr, kind, color }) => ({ id, name, nameAr, kind: kind as "income" | "expense", color })),
    transactions: cleanTransactions, transfers: cleanTransfers,
    budgets: budgets.map(({ id, categoryId, month, amount, currency }) => ({ id, categoryId, month, amount, currency: currency as Currency, spent: exactSum(transactions.filter(t => t.kind === "expense" && t.categoryId === categoryId && t.date.startsWith(month) && t.currency === currency).map(t => t.amount)) })),
    goals: goals.map(({ id, name, target, currency, deadline }) => ({ id, name, target, currency: currency as Currency, deadline, saved: exactSum(contributions.filter(c => c.goalId === id).map(c => c.amount)) })),
    contributions: contributions.map(({ id, goalId, accountId, amount, date }) => ({ id, goalId, accountId, amount, date })),
    recurring: recurring.map(({ id, name, accountId, categoryId, kind, amount, currency, frequency, nextDate, active }) => ({ id, name, accountId, categoryId, kind: kind as Recurring["kind"], amount, currency: currency as Currency, frequency: frequency as Recurring["frequency"], nextDate, active })),
    notes: notes.map(({ id, title, body, createdAt }) => ({ id, title, body, createdAt: createdAt.toISOString() })),
    processedRecurringKeys: processedRecurringEvents.map(event => event.key),
    demo: owner.demo,
  };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

async function ownedAccount(tx: Tx, userId: string, id: string) {
  const [account] = await tx.select().from(s.financialAccounts).where(and(eq(s.financialAccounts.id, id), eq(s.financialAccounts.userId, userId)));
  if (!account) throw new v.ServiceError("Account not found.", 404);
  return account;
}
async function ownedCategory(tx: Tx, userId: string, id: string) {
  const [category] = await tx.select().from(s.categories).where(and(eq(s.categories.id, id), eq(s.categories.userId, userId)));
  if (!category) throw new v.ServiceError("Category not found.", 404);
  return category;
}
async function validateTransaction(tx: Tx, userId: string, data: Pick<Transaction, "accountId" | "categoryId" | "kind" | "currency">) {
  const account = await ownedAccount(tx, userId, data.accountId);
  const category = await ownedCategory(tx, userId, data.categoryId);
  if (account.currency !== data.currency) throw new v.ServiceError("The currency must match the account. Currency conversion is not configured.");
  if (category.kind !== data.kind) throw new v.ServiceError("The category must match income or expense.");
}
async function balanceInTransaction(tx: Tx, userId: string, account: typeof s.financialAccounts.$inferSelect) {
  const transactions = await tx.select().from(s.transactions).where(and(eq(s.transactions.userId, userId), eq(s.transactions.accountId, account.id)));
  const transfers = await tx.select().from(s.transfers).where(eq(s.transfers.userId, userId));
  return accountBalance(account, transactions.map(t => ({ ...t, kind: t.kind as Transaction["kind"] })), transfers);
}
export function transactionFingerprint(row: Omit<Transaction, "id">): string {
  return createHash("sha256").update(JSON.stringify([row.accountId, row.categoryId, row.kind, row.amount, row.currency, row.date, row.note.trim()])).digest("hex");
}
async function claimEvent(tx: Tx, userId: string, key: string): Promise<boolean> {
  const inserted = await tx.insert(s.processedEvents).values({ id: randomUUID(), userId, key }).onConflictDoNothing().returning({ id: s.processedEvents.id });
  return inserted.length > 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export async function mutateFinance(userId: string, payload: unknown, requestId?: string): Promise<Snapshot & { imported?: number; skipped?: number; processed?: number }> {
  const input = z.object({ action: z.string() }).passthrough().parse(payload);
  const retryKey = requestId === undefined ? undefined : z.string().uuid().parse(requestId);
  const payloadHash = retryKey ? createHash("sha256").update(canonicalJson(input)).digest("hex") : undefined;
  await ensureProfile(userId);
  const db = await getDb();
  let imported: number | undefined, skipped: number | undefined, processed: number | undefined;
  await db.transaction(async tx => {
    // One user-level row lock serializes ledger writes and read/check/write invariants across workers.
    const [owner] = await tx.select().from(s.user).where(eq(s.user.id, userId)).for("update");
    if (!owner) throw new v.ServiceError("Session expired.", 401);
    if (retryKey) {
      const [previous] = await tx.select().from(s.mutationRequests).where(and(eq(s.mutationRequests.userId, userId), eq(s.mutationRequests.requestId, retryKey)));
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new v.ServiceError("This request was already used for different changes.", 409);
        ({ imported, skipped, processed } = previous.result);
        return;
      }
    }
    switch (input.action) {
      case "onboarding": {
        const data = v.onboardingSchema.parse(input);
        const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
        if (profile.onboarded) throw new v.ServiceError("Your account is already set up.", 409);
        await tx.update(s.user).set({ name: data.name, updatedAt: new Date() }).where(eq(s.user.id, userId));
        await tx.update(s.profiles).set({ locale: data.locale, currency: data.currency, timezone: data.timezone, onboarded: true }).where(eq(s.profiles.userId, userId));
        await tx.insert(s.financialAccounts).values({ id: randomUUID(), userId, name: data.accountName, type: data.accountType, currency: data.currency, openingBalance: data.openingBalance });
        break;
      }
      case "account.create": {
        const data = v.accountSchema.parse(input);
        await tx.insert(s.financialAccounts).values({ ...data, id: randomUUID(), userId }); break;
      }
      case "transaction.create":
      case "transaction.update": {
        const data = v.transactionSchema.parse(input);
        await validateTransaction(tx, userId, data);
        if (input.action === "transaction.create") await tx.insert(s.transactions).values({ ...data, id: randomUUID(), userId });
        else {
          const id = v.idSchema.parse(input.id);
          const changed = await tx.update(s.transactions).set(data).where(and(eq(s.transactions.id, id), eq(s.transactions.userId, userId))).returning({ id: s.transactions.id });
          if (!changed.length) throw new v.ServiceError("Transaction not found.", 404);
        }
        break;
      }
      case "transaction.delete": {
        const id = v.idSchema.parse(input.id);
        const removed = await tx.delete(s.transactions).where(and(eq(s.transactions.id, id), eq(s.transactions.userId, userId))).returning({ id: s.transactions.id });
        if (!removed.length) throw new v.ServiceError("Transaction not found.", 404);
        break;
      }
      case "transfer.create": {
        const data = v.transferSchema.parse(input);
        if (data.fromAccountId === data.toAccountId) throw new v.ServiceError("Choose two different accounts.");
        const from = await ownedAccount(tx, userId, data.fromAccountId);
        const to = await ownedAccount(tx, userId, data.toAccountId);
        if (from.currency !== to.currency) throw new v.ServiceError("Transfers require accounts in the same currency. No exchange rate is configured.");
        if (await balanceInTransaction(tx, userId, from) < data.amount) throw new v.ServiceError("The source account has insufficient funds.");
        await tx.insert(s.transfers).values({ ...data, id: randomUUID(), userId }); break;
      }
      case "budget.save": {
        const data = v.budgetSchema.parse(input);
        if ((await ownedCategory(tx, userId, data.categoryId)).kind !== "expense") throw new v.ServiceError("Budgets require an expense category.");
        if (input.id) {
          const id = v.idSchema.parse(input.id);
          const changed = await tx.update(s.budgets).set(data).where(and(eq(s.budgets.id, id), eq(s.budgets.userId, userId))).returning({ id: s.budgets.id });
          if (!changed.length) throw new v.ServiceError("Budget not found.", 404);
        } else await tx.insert(s.budgets).values({ ...data, id: randomUUID(), userId }).onConflictDoUpdate({ target: [s.budgets.userId, s.budgets.categoryId, s.budgets.month, s.budgets.currency], set: { amount: data.amount } });
        break;
      }
      case "budget.delete": {
        const removed = await tx.delete(s.budgets).where(and(eq(s.budgets.id, v.idSchema.parse(input.id)), eq(s.budgets.userId, userId))).returning({ id: s.budgets.id });
        if (!removed.length) throw new v.ServiceError("Budget not found.", 404); break;
      }
      case "goal.create": await tx.insert(s.goals).values({ ...v.goalSchema.parse(input), id: randomUUID(), userId }); break;
      case "goal.delete": {
        const removed = await tx.delete(s.goals).where(and(eq(s.goals.id, v.idSchema.parse(input.id)), eq(s.goals.userId, userId))).returning({ id: s.goals.id });
        if (!removed.length) throw new v.ServiceError("Goal not found.", 404); break;
      }
      case "contribution.create": {
        const data = v.contributionSchema.parse(input);
        const [goal] = await tx.select().from(s.goals).where(and(eq(s.goals.id, data.goalId), eq(s.goals.userId, userId)));
        if (!goal) throw new v.ServiceError("Goal not found.", 404);
        const account = await ownedAccount(tx, userId, data.accountId);
        if (goal.currency !== account.currency) throw new v.ServiceError("Goal and account currencies must match.");
        const allocated = await tx.select().from(s.contributions).where(and(eq(s.contributions.userId, userId), eq(s.contributions.accountId, account.id)));
        if (await balanceInTransaction(tx, userId, account) - exactSum(allocated.map(c => c.amount)) < data.amount) throw new v.ServiceError("There is not enough unallocated money in this account.");
        // Allocations are not expenses. They never create ledger debits or reduce account balances.
        await tx.insert(s.contributions).values({ ...data, id: randomUUID(), userId }); break;
      }
      case "recurring.create": {
        const data = v.recurringSchema.parse(input);
        await validateTransaction(tx, userId, data);
        await tx.insert(s.recurring).values({ ...data, id: randomUUID(), userId }); break;
      }
      case "recurring.update": {
        const id = v.idSchema.parse(input.id);
        const [existing] = await tx.select().from(s.recurring).where(and(eq(s.recurring.id, id), eq(s.recurring.userId, userId)));
        if (!existing) throw new v.ServiceError("Recurring transaction not found.", 404);
        const data = v.recurringSchema.parse({ ...existing, ...input });
        await validateTransaction(tx, userId, data);
        await tx.update(s.recurring).set(data).where(and(eq(s.recurring.id, id), eq(s.recurring.userId, userId))); break;
      }
      case "recurring.process": {
        processed = 0;
        const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
        const today = localDate(profile.timezone);
        const schedules = await tx.select().from(s.recurring).where(and(eq(s.recurring.userId, userId), eq(s.recurring.active, true)));
        for (const schedule of schedules) {
          let nextDate = schedule.nextDate, count = 0;
          while (nextDate <= today && count < 120) {
            const key = `recurring:${schedule.id}:${nextDate}`;
            if (await claimEvent(tx, userId, key)) {
              await tx.insert(s.transactions).values({ id: randomUUID(), userId, accountId: schedule.accountId, categoryId: schedule.categoryId, kind: schedule.kind, amount: schedule.amount, currency: schedule.currency, date: nextDate, note: schedule.name, sourceKey: key });
              processed++;
            }
            nextDate = nextOccurrence(nextDate, schedule.frequency as Recurring["frequency"]); count++;
          }
          await tx.update(s.recurring).set({ nextDate }).where(and(eq(s.recurring.id, schedule.id), eq(s.recurring.userId, userId)));
        }
        break;
      }
      case "note.create": await tx.insert(s.notes).values({ ...v.noteSchema.parse(input), id: randomUUID(), userId }); break;
      case "note.delete": {
        const removed = await tx.delete(s.notes).where(and(eq(s.notes.id, v.idSchema.parse(input.id)), eq(s.notes.userId, userId))).returning({ id: s.notes.id });
        if (!removed.length) throw new v.ServiceError("Note not found.", 404); break;
      }
      case "profile.update": {
        const [existingProfile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
        const data = v.profileSchema.parse({ name: owner.name, ...existingProfile, ...input });
        await tx.update(s.user).set({ name: data.name, updatedAt: new Date() }).where(eq(s.user.id, userId));
        await tx.update(s.profiles).set({ locale: data.locale, currency: data.currency, timezone: data.timezone }).where(eq(s.profiles.userId, userId)); break;
      }
      case "import.commit": {
        const rows = z.array(v.transactionSchema).min(1).max(2000).parse(input.rows);
        for (const row of rows) await validateTransaction(tx, userId, row);
        const existing = await tx.select().from(s.transactions).where(eq(s.transactions.userId, userId));
        const fingerprints = new Set(existing.map(row => transactionFingerprint({ ...row, kind: row.kind as Transaction["kind"], currency: row.currency as Currency })));
        imported = 0; skipped = 0;
        for (const row of rows) {
          const fingerprint = transactionFingerprint(row);
          const key = `import:${fingerprint}`;
          if (!await claimEvent(tx, userId, key) || fingerprints.has(fingerprint)) { skipped++; continue; }
          await tx.insert(s.transactions).values({ ...row, id: randomUUID(), userId, sourceKey: key });
          fingerprints.add(fingerprint); imported++;
        }
        break;
      }
      default: throw new v.ServiceError("Unknown action.");
    }
    if (retryKey) await tx.insert(s.mutationRequests).values({ userId, requestId: retryKey, payloadHash: payloadHash!, result: { ...(imported === undefined ? {} : { imported, skipped }), ...(processed === undefined ? {} : { processed }) } });
  });
  return { ...await getSnapshot(userId), ...(imported === undefined ? {} : { imported, skipped }), ...(processed === undefined ? {} : { processed }) };
}

export async function deleteUserData(userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async tx => {
    const [owner] = await tx.select().from(s.user).where(eq(s.user.id, userId)).for("update");
    if (!owner) throw new v.ServiceError("Account not found.", 404);
    // Delete dependent ledger records explicitly before account/category rows; cascade removes auth and profile records.
    await tx.delete(s.transactions).where(eq(s.transactions.userId, userId));
    await tx.delete(s.transfers).where(eq(s.transfers.userId, userId));
    await tx.delete(s.contributions).where(eq(s.contributions.userId, userId));
    await tx.delete(s.budgets).where(eq(s.budgets.userId, userId));
    await tx.delete(s.recurring).where(eq(s.recurring.userId, userId));
    await tx.delete(s.verification).where(or(eq(s.verification.identifier, owner.email), eq(s.verification.value, userId)));
    await tx.delete(s.user).where(eq(s.user.id, userId));
  });
}
