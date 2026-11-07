import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db";
import { processedEvents, user } from "@/server/schema";
import { deleteUserData, getSnapshot, mutateFinance } from "@/server/finance-service";
import { addDays, simulatePurchase, type SimulationInput } from "@/lib/simulator";
import type { Transaction } from "@/lib/contracts";

let ownerA: string;
let ownerB: string;
let asOf: string;
let createdUsers: string[];

function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    currency: "ILS", asOf, horizonDays: 7, dailySpending: 0,
    scenarioDailySpending: 0, purchaseAmount: 0, purchaseDate: asOf,
    buffer: 0, protectGoals: true, excludedRecurringIds: [], ...overrides,
  };
}

async function addTransaction(ownerId: string, kind: Transaction["kind"], amount: number, date: string, note: string) {
  const snapshot = await getSnapshot(ownerId);
  return mutateFinance(ownerId, {
    action: "transaction.create", accountId: snapshot.accounts[0].id,
    categoryId: snapshot.categories.find(category => category.kind === kind)!.id,
    kind, amount, currency: "ILS", date, note,
  });
}

async function addSchedule(ownerId: string, name: string, nextDate: string, amount = 1_234) {
  const snapshot = await getSnapshot(ownerId);
  const result = await mutateFinance(ownerId, {
    action: "recurring.create", name, nextDate, amount,
    accountId: snapshot.accounts[0].id,
    categoryId: snapshot.categories.find(category => category.kind === "expense")!.id,
    kind: "expense", currency: "ILS", frequency: "monthly", active: true,
  });
  return result.recurring.find(schedule => schedule.name === name)!;
}

beforeEach(async () => {
  asOf = new Date().toISOString().slice(0, 10);
  ownerA = randomUUID();
  ownerB = randomUUID();
  createdUsers = [];
  const db = await getDb();
  for (const [index, id] of [ownerA, ownerB].entries()) {
    await db.insert(user).values({
      id, name: `Simulator owner ${index}`, email: `${id}@example.test`,
      emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
    });
    createdUsers.push(id);
    await mutateFinance(id, {
      action: "onboarding", name: `Simulator owner ${index}`, locale: "en",
      currency: "ILS", timezone: "UTC", accountName: "Primary",
      accountType: "bank", openingBalance: index === 0 ? 500_000 : 990_000,
    });
  }
});

afterEach(async () => {
  for (const id of createdUsers) await deleteUserData(id);
});

afterAll(async () => {
  await closeDb();
});

describe("purchase simulator with owner-scoped database snapshots", () => {
  it("rebuilds the actual as-of ledger: 5,000 + 2,000 − 300 = 6,700", async () => {
    await addTransaction(ownerA, "income", 200_000, asOf, "Income received");
    await addTransaction(ownerA, "expense", 30_000, asOf, "Expense paid");
    await addTransaction(ownerB, "income", 750_000, asOf, "Other owner's income");

    const snapshot = await getSnapshot(ownerA);
    const result = simulatePurchase(snapshot, input({ purchaseAmount: 20_000 }));

    expect(snapshot.accounts[0].balance).toBe(670_000);
    expect(result.openingBalance).toBe(670_000);
    expect(result.baseline.endingBalance).toBe(670_000);
    expect(result.scenario.endingBalance).toBe(650_000);
    expect(result.events).toHaveLength(0);
    expect(result.accountCount).toBe(1);
    expect(snapshot.transactions.map(row => row.sourceKey)).toEqual([null, null]);
    expect(snapshot.transactions.some(row => row.note === "Other owner's income")).toBe(false);
  });

  it("round-trips recurring provenance without exposing another owner's keys or import keys", async () => {
    const scheduleA = await addSchedule(ownerA, "Owner A subscription", asOf);
    const scheduleB = await addSchedule(ownerB, "Owner B subscription", asOf, 2_222);
    await mutateFinance(ownerA, { action: "recurring.process" });
    await mutateFinance(ownerB, { action: "recurring.process" });
    const beforeImport = await getSnapshot(ownerA);
    await mutateFinance(ownerA, {
      action: "import.commit", rows: [{
        accountId: beforeImport.accounts[0].id,
        categoryId: beforeImport.categories.find(category => category.kind === "expense")!.id,
        kind: "expense", amount: 444, currency: "ILS", date: asOf, note: "CSV-only expense",
      }],
    });

    const snapshotA = await getSnapshot(ownerA);
    const snapshotB = await getSnapshot(ownerB);
    const keyA = `recurring:${scheduleA.id}:${asOf}`;
    const keyB = `recurring:${scheduleB.id}:${asOf}`;
    expect(snapshotA.processedRecurringKeys).toEqual([keyA]);
    expect(snapshotB.processedRecurringKeys).toEqual([keyB]);
    expect(snapshotA.transactions.find(row => row.note === scheduleA.name)!.sourceKey).toBe(keyA);
    expect(snapshotB.transactions.find(row => row.note === scheduleB.name)!.sourceKey).toBe(keyB);
    expect(snapshotA.transactions.find(row => row.note === "CSV-only expense")!.sourceKey).toMatch(/^import:/);
    expect(snapshotA.processedRecurringKeys!.some(key => key.startsWith("import:"))).toBe(false);
    expect(snapshotA.processedRecurringKeys).not.toContain(keyB);
    expect(snapshotB.processedRecurringKeys).not.toContain(keyA);
    expect(snapshotA.recurring.some(row => row.id === scheduleB.id)).toBe(false);
    expect(snapshotB.accounts.some(account => snapshotA.accounts.some(other => other.id === account.id))).toBe(false);
    expect(simulatePurchase(snapshotA, input()).baseline.endingBalance).toBe(500_000 - 1_234 - 444);
    expect(simulatePurchase(snapshotB, input()).baseline.endingBalance).toBe(990_000 - 2_222);
  });

  it("does not reforecast a processed occurrence after its row is deleted and schedule rewound", async () => {
    const schedule = await addSchedule(ownerA, "Deleted recorded occurrence", asOf);
    await mutateFinance(ownerA, { action: "recurring.process" });
    const recorded = (await getSnapshot(ownerA)).transactions.find(row => row.note === schedule.name)!;
    const key = `recurring:${schedule.id}:${asOf}`;
    expect(recorded.sourceKey).toBe(key);
    await mutateFinance(ownerA, { action: "transaction.delete", id: recorded.id });
    await mutateFinance(ownerA, { action: "recurring.update", id: schedule.id, nextDate: asOf });

    const snapshot = await getSnapshot(ownerA);
    const result = simulatePurchase(snapshot, input());

    expect(snapshot.transactions).toHaveLength(0);
    expect(snapshot.processedRecurringKeys).toEqual([key]);
    expect(snapshot.recurring[0].nextDate).toBe(asOf);
    expect(result.events.some(event => event.id === key)).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(result.openingBalance).toBe(500_000);
    expect(result.baseline.endingBalance).toBe(500_000);
  });

  it("counts a recorded recurring row once when it lies after the simulation's as-of date", async () => {
    const schedule = await addSchedule(ownerA, "Recorded after as-of", asOf);
    await mutateFinance(ownerA, { action: "recurring.process" });
    await mutateFinance(ownerA, { action: "recurring.update", id: schedule.id, nextDate: asOf });
    const snapshot = await getSnapshot(ownerA);
    const recorded = snapshot.transactions[0];
    const result = simulatePurchase(snapshot, input({ asOf: addDays(asOf, -1) }));

    expect(result.openingBalance).toBe(500_000);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ id: `transaction:${recorded.id}`, source: "recorded", date: asOf, amount: 1_234 });
    expect(result.baseline.endingBalance).toBe(498_766);
    expect(result.rows.find(row => row.date === asOf)!.expense).toBe(1_234);
  });

  it("applies true future-dated ledger rows on their dates exactly once", async () => {
    await addTransaction(ownerA, "income", 10_000, asOf, "Already received");
    await addTransaction(ownerA, "expense", 30_000, addDays(asOf, 2), "Future expense");
    await addTransaction(ownerA, "income", 200_000, addDays(asOf, 3), "Future income");
    const snapshot = await getSnapshot(ownerA);
    const result = simulatePurchase(snapshot, input());

    expect(snapshot.accounts[0].balance).toBe(680_000);
    expect(result.openingBalance).toBe(510_000);
    expect(result.events).toHaveLength(2);
    expect(new Set(result.events.map(event => event.id)).size).toBe(2);
    expect(result.rows.find(row => row.date === addDays(asOf, 1))!.baseline).toBe(510_000);
    expect(result.rows.find(row => row.date === addDays(asOf, 2))!.baseline).toBe(480_000);
    expect(result.rows.find(row => row.date === addDays(asOf, 3))!.baseline).toBe(680_000);
    expect(result.baseline.endingBalance).toBe(680_000);
  });

  it("keeps today's and future internal transfers neutral in the pooled currency projection", async () => {
    await mutateFinance(ownerA, { action: "account.create", name: "Cash", type: "cash", currency: "ILS", openingBalance: 0 });
    const before = await getSnapshot(ownerA);
    const fromAccountId = before.accounts.find(account => account.name === "Primary")!.id;
    const toAccountId = before.accounts.find(account => account.name === "Cash")!.id;
    await mutateFinance(ownerA, { action: "transfer.create", fromAccountId, toAccountId, amount: 50_000, date: asOf, note: "Today transfer" });
    await mutateFinance(ownerA, { action: "transfer.create", fromAccountId, toAccountId, amount: 25_000, date: addDays(asOf, 2), note: "Future transfer" });
    const after = await getSnapshot(ownerA);
    const beforeResult = simulatePurchase(before, input());
    const afterResult = simulatePurchase(after, input());

    expect(after.transfers).toHaveLength(2);
    expect(after.accounts.find(account => account.id === fromAccountId)!.balance).toBe(425_000);
    expect(after.accounts.find(account => account.id === toAccountId)!.balance).toBe(75_000);
    expect(afterResult.accountCount).toBe(2);
    expect(afterResult.openingBalance).toBe(500_000);
    expect(afterResult.rows).toEqual(beforeResult.rows);
    expect(afterResult.events).toHaveLength(0);
    expect((await getSnapshot(ownerB)).accounts[0].balance).toBe(990_000);
  });

  it("repeats calculations without writing ledger data or persisting scenario choices", async () => {
    const schedule = await addSchedule(ownerA, "Simulation-only exclusion", addDays(asOf, 3), 4_000);
    await addTransaction(ownerA, "expense", 2_000, addDays(asOf, 2), "Known future cost");
    await mutateFinance(ownerA, { action: "goal.create", name: "Protected reserve", target: 100_000, currency: "ILS", deadline: addDays(asOf, 60) });
    const withGoal = await getSnapshot(ownerA);
    await mutateFinance(ownerA, { action: "contribution.create", goalId: withGoal.goals[0].id, accountId: withGoal.accounts[0].id, amount: 20_000, date: asOf });
    const snapshot = await getSnapshot(ownerA);
    const snapshotBefore = structuredClone(snapshot);
    const scenarioInput = input({
      dailySpending: 500, scenarioDailySpending: 250, purchaseAmount: 10_000,
      purchaseDate: addDays(asOf, 2), buffer: 5_000, excludedRecurringIds: [schedule.id],
    });
    const inputBefore = structuredClone(scenarioInput);
    const db = await getDb();
    const ownerBefore = await db.select().from(user).where(eq(user.id, ownerA));
    const eventsBefore = await db.select().from(processedEvents).where(eq(processedEvents.userId, ownerA)).orderBy(asc(processedEvents.key));

    const first = simulatePurchase(snapshot, scenarioInput);
    const second = simulatePurchase(snapshot, scenarioInput);

    expect(second).toEqual(first);
    expect(snapshot).toEqual(snapshotBefore);
    expect(scenarioInput).toEqual(inputBefore);
    expect(first.protectedGoals).toBe(20_000);
    expect(first.reserveFloor).toBe(25_000);
    expect(first.events.some(event => event.recurringId === schedule.id)).toBe(false);
    const after = await getSnapshot(ownerA);
    expect(after).toEqual(snapshotBefore);
    expect(await db.select().from(user).where(eq(user.id, ownerA))).toEqual(ownerBefore);
    expect(await db.select().from(processedEvents).where(eq(processedEvents.userId, ownerA)).orderBy(asc(processedEvents.key))).toEqual(eventsBefore);
    expect(simulatePurchase(after, input()).events.some(event => event.recurringId === schedule.id)).toBe(true);
    expect((await getSnapshot(ownerB)).accounts[0].balance).toBe(990_000);
  });
});
