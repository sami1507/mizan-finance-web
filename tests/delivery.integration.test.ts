import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closeDb, getDb } from "@/server/db";
import { user } from "@/server/schema";
import { deleteUserData, getSnapshot, mutateFinance } from "@/server/finance-service";
import type { Snapshot } from "@/lib/contracts";

let owner: string;
let other: string;
let initial: Snapshot;
let otherInitial: Snapshot;
const date = "2026-01-15";

beforeEach(async () => {
  const db = await getDb();
  owner = randomUUID(); other = randomUUID();
  for (const id of [owner, other]) {
    await db.insert(user).values({ id, name: "Delivery QA", email: `${id}@example.test`, emailVerified: false });
    await mutateFinance(id, { action: "onboarding", name: "Delivery QA", locale: "en", currency: "ILS", timezone: "UTC", accountName: "Primary", accountType: "bank", openingBalance: 500_000 });
  }
  initial = await getSnapshot(owner);
  otherInitial = await getSnapshot(other);
});

afterEach(async () => {
  await deleteUserData(owner);
  await deleteUserData(other);
});
afterAll(closeDb);

function expense(data = initial, amount = 100) {
  return { action: "transaction.create", accountId: data.accounts[0].id, categoryId: data.categories.find(category => category.kind === "expense")!.id, kind: "expense", amount, currency: "ILS", date, note: "Delivery idempotency" };
}

describe("delivery concurrency and request identity", () => {
  it("commits one effect when simultaneous requests use the same idempotency key", async () => {
    const requestId = randomUUID();
    const input = expense(initial, 1234);
    const responses = await Promise.all([
      mutateFinance(owner, input, requestId),
      mutateFinance(owner, input, requestId),
    ]);
    const stored = await getSnapshot(owner);
    expect(stored.transactions).toHaveLength(1);
    expect(stored.accounts[0].balance).toBe(498_766);
    for (const response of responses) expect(response.transactions).toHaveLength(1);
    await mutateFinance(owner, input, requestId);
    expect(await getSnapshot(owner)).toEqual(stored);
  });

  it("rejects changed payloads for a committed key while keeping keys owner-scoped", async () => {
    const requestId = randomUUID();
    await mutateFinance(owner, expense(initial, 200), requestId);
    await expect(mutateFinance(owner, expense(initial, 300), requestId)).rejects.toMatchObject({ status: 409 });
    await mutateFinance(other, expense(otherInitial, 700), requestId);
    const a = await getSnapshot(owner), b = await getSnapshot(other);
    expect(a.transactions.map(row => row.amount)).toEqual([200]);
    expect(b.transactions.map(row => row.amount)).toEqual([700]);
    expect(a.accounts[0].balance).toBe(499_800);
    expect(b.accounts[0].balance).toBe(499_300);
  });

  it("does not reserve an idempotency key when the underlying transaction fails", async () => {
    const requestId = randomUUID();
    await expect(mutateFinance(owner, expense(initial, -1), requestId)).rejects.toThrow();
    await mutateFinance(owner, expense(initial, 500), requestId);
    expect((await getSnapshot(owner)).transactions.map(row => row.amount)).toEqual([500]);
  });

  it("serializes concurrent transfers before checking available funds", async () => {
    const withTarget = await mutateFinance(owner, { action: "account.create", name: "Target", type: "cash", currency: "ILS", openingBalance: 0 });
    const target = withTarget.accounts.find(account => account.name === "Target")!;
    const input = { action: "transfer.create", fromAccountId: initial.accounts[0].id, toAccountId: target.id, amount: 400_000, date, note: "Concurrent withdrawal" };
    const outcomes = await Promise.allSettled([mutateFinance(owner, input), mutateFinance(owner, input)]);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === "rejected")).toHaveLength(1);
    const stored = await getSnapshot(owner);
    expect(stored.transfers).toHaveLength(1);
    expect(stored.accounts.find(account => account.id === initial.accounts[0].id)!.balance).toBe(100_000);
    expect(stored.accounts.find(account => account.id === target.id)!.balance).toBe(400_000);
    expect(stored.transactions).toHaveLength(0);
  });

  it("prevents two concurrent goal allocations from earmarking the same available money", async () => {
    await mutateFinance(owner, { action: "goal.create", name: "First", target: 500_000, currency: "ILS", deadline: "2099-01-01" });
    const data = await mutateFinance(owner, { action: "goal.create", name: "Second", target: 500_000, currency: "ILS", deadline: "2099-01-01" });
    const outcomes = await Promise.allSettled(data.goals.map(goal => mutateFinance(owner, { action: "contribution.create", goalId: goal.id, accountId: initial.accounts[0].id, amount: 400_000, date })));
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === "rejected")).toHaveLength(1);
    const stored = await getSnapshot(owner);
    expect(stored.contributions).toHaveLength(1);
    expect(stored.goals.reduce((sum, goal) => sum + goal.saved, 0)).toBe(400_000);
    expect(stored.accounts[0].balance).toBe(500_000);
    expect(stored.transactions).toHaveLength(0);
  });
});

describe("delivery ownership and atomic failures", () => {
  it("rejects foreign references and records across budgets, notes, goals and recurring schedules", async () => {
    const categoryId = initial.categories.find(category => category.kind === "expense")!.id;
    await mutateFinance(owner, { action: "budget.save", categoryId, month: "2026-01", amount: 1000, currency: "ILS" });
    await mutateFinance(owner, { action: "goal.create", name: "Private goal", target: 1000, currency: "ILS", deadline: "2099-01-01" });
    await mutateFinance(owner, { action: "note.create", title: "Private note", body: "Owner only" });
    const stored = await mutateFinance(owner, { ...expense(), action: "recurring.create", name: "Private schedule", frequency: "monthly", nextDate: "2099-01-01", active: true });
    const attempts = [
      { action: "budget.delete", id: stored.budgets[0].id },
      { action: "budget.save", id: stored.budgets[0].id, categoryId: otherInitial.categories.find(category => category.kind === "expense")!.id, month: "2026-01", amount: 2000, currency: "ILS" },
      { action: "goal.delete", id: stored.goals[0].id },
      { action: "note.delete", id: stored.notes[0].id },
      { action: "recurring.update", id: stored.recurring[0].id, active: false },
      { ...expense(otherInitial), categoryId },
    ];
    for (const input of attempts) await expect(mutateFinance(other, { ...input, userId: owner })).rejects.toMatchObject({ status: 404 });
    expect(await getSnapshot(owner)).toEqual(stored);
    expect(await getSnapshot(other)).toEqual(otherInitial);
  });

  it("rolls back an entire mixed-owner import and ignores forged owner/source fields", async () => {
    const valid = expense();
    const foreign = { ...valid, categoryId: otherInitial.categories.find(category => category.kind === "expense")!.id };
    await expect(mutateFinance(owner, { action: "import.commit", rows: [valid, foreign] })).rejects.toMatchObject({ status: 404 });
    expect(await getSnapshot(owner)).toEqual(initial);
    const created = await mutateFinance(owner, { ...valid, userId: other, id: "forged-transaction", sourceKey: "recurring:forged:2026-01-15" });
    expect(created.transactions).toHaveLength(1);
    expect(created.transactions[0].id).not.toBe("forged-transaction");
    expect(created.transactions[0].sourceKey).toBeNull();
    expect(await getSnapshot(other)).toEqual(otherInitial);
    const imported = await mutateFinance(owner, { action: "import.commit", rows: [{ ...valid, note: "New valid import" }] });
    expect(imported.imported).toBe(1);
    expect(imported.skipped).toBe(0);
  });
});
