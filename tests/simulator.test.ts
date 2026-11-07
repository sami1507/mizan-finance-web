import { describe, expect, it } from "vitest";
import type { Snapshot, Recurring, Transaction } from "@/lib/contracts";
import { addDays, simulatePurchase, SimulationError, type SimulationInput } from "@/lib/simulator";

const asOf = "2026-11-07";
function fixture(): Snapshot {
  return {
    profile: { id: "u", name: "Test", email: "test@example.test", locale: "en", currency: "ILS", timezone: "Asia/Jerusalem", onboarded: true },
    accounts: [{ id: "a", name: "Bank", type: "bank", currency: "ILS", openingBalance: 500_000, balance: 999_999 }],
    transactions: [transaction("salary", "income", 200_000, asOf), transaction("food", "expense", 30_000, asOf)],
    categories: [], transfers: [], budgets: [], goals: [], contributions: [], recurring: [], notes: [], demo: false, processedRecurringKeys: [],
  };
}
function transaction(id: string, kind: "income" | "expense", amount: number, date: string): Transaction {
  return { id, accountId: "a", categoryId: kind, kind, amount, currency: "ILS", date, note: id };
}
function schedule(overrides: Partial<Recurring> = {}): Recurring {
  return { id: "r", name: "Rent", accountId: "a", categoryId: "expense", kind: "expense", amount: 30_000, currency: "ILS", frequency: "monthly", nextDate: "2026-11-09", active: true, ...overrides };
}
function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return { currency: "ILS", asOf, horizonDays: 30, dailySpending: 0, scenarioDailySpending: 0, purchaseAmount: 0, purchaseDate: asOf, buffer: 0, protectGoals: true, excludedRecurringIds: [], ...overrides };
}

describe("purchase simulator: independent financial examples", () => {
  it("rebuilds 5,000 + 2,000 − 300 = 6,700 rather than trusting a cached/future balance", () => {
    const result = simulatePurchase(fixture(), input());
    expect(result.openingBalance).toBe(670_000);
    expect(result.baseline.endingBalance).toBe(670_000);
    expect(result.rows).toHaveLength(31);
    expect(result.delta.endingBalance).toBe(0);
  });

  it("matches a hand-calculated 30-day purchase and reduced daily-spending scenario", () => {
    const data = fixture();
    data.recurring = [schedule({ id: "pay", categoryId: "income", kind: "income", amount: 200_000, nextDate: "2026-11-08" }), schedule({ amount: 300_000 })];
    data.goals = [{ id: "g", name: "Reserve", target: 200_000, saved: 100_000, currency: "ILS", deadline: "2027-01-01" }];
    data.contributions = [{ id: "c", goalId: "g", accountId: "a", amount: 100_000, date: asOf }];
    const plan = input({ dailySpending: 10_000, scenarioDailySpending: 8_000, purchaseAmount: 500_000, purchaseDate: "2026-11-09", buffer: 50_000 });
    const result = simulatePurchase(data, plan);
    expect(result.reserveFloor).toBe(150_000);
    expect(result.rows[1]).toMatchObject({ baseline: 860_000, scenario: 862_000 });
    expect(result.rows[2]).toMatchObject({ baseline: 550_000, scenario: 54_000 });
    // Baseline: 6700 + 2000 − 3000 − 30×100 = 2700.
    // Scenario: 6700 + 2000 − 3000 − 30×80 − 5000 = −1700.
    expect(result.baseline.endingBalance).toBe(270_000);
    expect(result.scenario.endingBalance).toBe(-170_000);
    expect(result.delta).toEqual({ endingBalance: -440_000, minimumBalance: -440_000 });
    expect(result.scenario.firstBreachDate).toBe("2026-11-09");
    expect(result.baseline.firstBreachDate).toBeNull();
    expect(result.purchaseCapacity).toBe(180_000);
    expect(simulatePurchase(data, { ...plan, purchaseAmount: 180_000 }).scenario.firstBreachDate).toBeNull();
    expect(simulatePurchase(data, { ...plan, purchaseAmount: 180_001 }).scenario.firstBreachDate).toBe("2026-12-07");
  });

  it("counts future recorded transactions once, only on their dates", () => {
    const data = fixture();
    data.transactions.push(transaction("future", "expense", 100_000, "2026-11-10"));
    const result = simulatePurchase(data, input());
    expect(result.openingBalance).toBe(670_000);
    expect(result.rows[2].baseline).toBe(670_000);
    expect(result.rows[3].baseline).toBe(570_000);
    expect(result.events).toHaveLength(1);
  });

  it("preserves a pooled currency balance across internal transfers", () => {
    const data = fixture();
    data.accounts.push({ id: "b", name: "Cash", type: "cash", currency: "ILS", openingBalance: 0, balance: 200_000 });
    const before = simulatePurchase(data, input());
    data.transfers = [{ id: "tr", fromAccountId: "a", toAccountId: "b", amount: 200_000, date: asOf, note: "" }];
    expect(simulatePurchase(data, input()).rows).toEqual(before.rows);
  });

  it("protects earmarks without subtracting them from money; excludes future allocations", () => {
    const data = fixture();
    data.goals = [{ id: "g", name: "Goal", target: 500_000, saved: 400_000, currency: "ILS", deadline: "2027-01-01" }];
    data.contributions = [{ id: "c", goalId: "g", accountId: "a", amount: 100_000, date: asOf }, { id: "later", goalId: "g", accountId: "a", amount: 300_000, date: "2026-12-01" }];
    const result = simulatePurchase(data, input({ buffer: 50_000 }));
    expect(result.openingBalance).toBe(670_000);
    expect(result.protectedGoals).toBe(100_000);
    expect(result.reserveFloor).toBe(150_000);
    expect(result.purchaseCapacity).toBe(520_000);
    expect(result.futureContributionCount).toBe(1);
    expect(simulatePurchase(data, input({ protectGoals: false })).protectedGoals).toBe(0);
  });

  it("keeps currencies separate, including goals and scheduled entries", () => {
    const data = fixture();
    data.accounts.push({ id: "usd", name: "USD", type: "bank", currency: "USD", openingBalance: 9_000_000, balance: 9_000_000 });
    data.transactions.push({ ...transaction("usd-tx", "income", 400_000, asOf), accountId: "usd", currency: "USD" });
    data.recurring.push(schedule({ id: "usd-r", accountId: "usd", currency: "USD" }));
    expect(simulatePurchase(data, input()).openingBalance).toBe(670_000);
    expect(simulatePurchase(data, input({ currency: "USD" })).openingBalance).toBe(9_400_000);
  });
});

describe("schedule provenance, duplicates and calendar boundaries", () => {
  it("skips processed occurrences even after their ledger row is deleted", () => {
    const data = fixture();
    data.recurring = [schedule()];
    data.processedRecurringKeys = ["recurring:r:2026-11-09"];
    expect(simulatePurchase(data, input()).events).toHaveLength(0);
  });
  it("uses row provenance even if the event key list is missing", () => {
    const data = fixture();
    data.recurring = [schedule()];
    data.transactions.push({ ...transaction("recorded-r", "expense", 30_000, "2026-11-09"), sourceKey: "recurring:r:2026-11-09" });
    const result = simulatePurchase(data, input());
    expect(result.events).toHaveLength(1);
    expect(result.baseline.endingBalance).toBe(640_000);
    expect(result.possibleDuplicateRecurringIds).toEqual([]);
  });
  it("flags possible manual overlaps without pretending matching values prove identity", () => {
    const data = fixture();
    data.recurring = [schedule()];
    data.transactions.push(transaction("manual", "expense", 30_000, "2026-11-09"));
    expect(simulatePurchase(data, input()).possibleDuplicateRecurringIds).toEqual(["r"]);
    expect(simulatePurchase(data, input()).possibleDuplicates).toEqual([{ recurringId: "r", transactionId: "manual", date: "2026-11-09", amount: 30_000, note: "manual" }]);
    const excluded = simulatePurchase(data, input({ excludedRecurringIds: ["r"] }));
    expect(excluded.possibleDuplicateRecurringIds).toEqual([]);
    expect(excluded.baseline.endingBalance).toBe(640_000);
    expect(data.recurring[0].active).toBe(true);
  });
  it("treats CSV-provenance records as possible manual overlaps too", () => {
    const data = fixture();
    data.recurring = [schedule()];
    data.transactions.push({ ...transaction("csv", "expense", 30_000, "2026-11-09"), sourceKey: "import:fingerprint" });
    expect(simulatePurchase(data, input()).possibleDuplicateRecurringIds).toEqual(["r"]);
  });
  it("deduplicates repeated identities but keeps genuinely separate equal transactions", () => {
    const data = fixture();
    data.transactions.push({ ...data.transactions[1] });
    data.recurring = [schedule(), schedule()];
    const result = simulatePurchase(data, input());
    expect(result.openingBalance).toBe(670_000);
    expect(result.events).toHaveLength(1);
    data.transactions.push({ ...data.transactions[1], id: "another-expense" });
    expect(simulatePurchase(data, input()).openingBalance).toBe(640_000);
  });
  it("rejects conflicting duplicate IDs", () => {
    const data = fixture();
    data.transactions.push({ ...data.transactions[1], amount: 200 });
    expect(() => simulatePurchase(data, input())).toThrow("invalid-data");
  });
  it("projects overdue unprocessed entries today and never changes the schedule", () => {
    const data = fixture();
    data.recurring = [schedule({ nextDate: "2026-10-31", frequency: "weekly" })];
    const result = simulatePurchase(data, input({ horizonDays: 1 }));
    expect(result.overdueCount).toBe(1);
    expect(result.events.map(event => event.originalDate)).toEqual(["2026-10-31", "2026-11-07"]);
    expect(result.rows[0].baseline).toBe(610_000);
    expect(data.recurring[0].nextDate).toBe("2026-10-31");
  });
  it("ignores inactive/excluded schedules and events beyond the horizon", () => {
    const data = fixture();
    data.recurring = [schedule({ active: false }), schedule({ id: "excluded" }), schedule({ id: "later", nextDate: "2027-01-01" })];
    data.transactions.push(transaction("later", "income", 200_000, "2027-01-01"));
    expect(simulatePurchase(data, input({ excludedRecurringIds: ["excluded"] })).events).toHaveLength(0);
  });
  it("uses the ledger recurrence convention at month-end and leap year", () => {
    const data = fixture();
    data.transactions = [];
    data.recurring = [schedule({ nextDate: "2028-01-31" })];
    const result = simulatePurchase(data, input({ asOf: "2028-01-30", purchaseDate: "2028-01-30", horizonDays: 60 }));
    expect(result.events.map(row => row.date)).toEqual(["2028-01-31", "2028-02-29", "2028-03-29"]);
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("rejects excessively stale schedules instead of silently omitting debt", () => {
    const data = fixture();
    data.recurring = [schedule({ nextDate: "1900-01-01", frequency: "weekly" })];
    expect(() => simulatePurchase(data, input())).toThrow("stale-schedule");
  });
});

describe("input validity and decision boundaries", () => {
  it.each([NaN, Infinity, -1, 0.1, 1_000_000_000_001])("rejects invalid money %s", value => {
    expect(() => simulatePurchase(fixture(), input({ purchaseAmount: value }))).toThrow(SimulationError);
  });
  it.each([0, 91, 1.5, NaN])("rejects unsupported horizon %s", horizonDays => {
    expect(() => simulatePurchase(fixture(), input({ horizonDays }))).toThrow("invalid-horizon");
  });
  it("rejects invalid/out-of-range dates", () => {
    for (const purchaseDate of ["2026-02-30", "bad", "2026-11-06", "2026-12-08"]) expect(() => simulatePurchase(fixture(), input({ purchaseDate }))).toThrow("invalid-date");
    expect(() => addDays("2199-12-31", 1)).toThrow("invalid-date");
    expect(() => addDays(asOf, Number.MAX_SAFE_INTEGER)).toThrow("invalid-date");
  });
  it("shows missing accounts rather than a fabricated zero balance", () => {
    expect(() => simulatePurchase(fixture(), input({ currency: "EUR" }))).toThrow("no-accounts");
  });
  it("allows zero money and negative balances; equality with the reserve is not a breach", () => {
    const data = fixture();
    data.transactions = [];
    data.accounts[0].openingBalance = 0;
    expect(simulatePurchase(data, input()).scenario.firstBreachDate).toBeNull();
    data.accounts[0].openingBalance = -1;
    expect(simulatePurchase(data, input()).scenario.firstBreachDate).toBe(asOf);
    expect(simulatePurchase(data, input()).purchaseCapacity).toBe(0);
  });
  it("flags pre-purchase shortfalls separately from later purchase capacity", () => {
    const data = fixture();
    data.transactions = [transaction("future", "income", 900_000, "2026-11-10")];
    const result = simulatePurchase(data, input({ purchaseDate: "2026-11-11", buffer: 600_000 }));
    expect(result.prePurchaseBreach).toBe(true);
    expect(result.purchaseCapacity).toBe(800_000);
    expect(result.scenario.firstBreachDate).toBe(asOf);
  });
  it("changes only the scenario after the purchase date, including the last day", () => {
    const result = simulatePurchase(fixture(), input({ purchaseAmount: 1, purchaseDate: "2026-12-07" }));
    expect(result.rows.slice(0, -1).every(row => row.delta === 0)).toBe(true);
    expect(result.rows.at(-1)!.delta).toBe(-1);
    const cheaper = simulatePurchase(fixture(), input({ dailySpending: 2, scenarioDailySpending: 1, purchaseAmount: 10 }));
    expect(cheaper.delta.endingBalance).toBe(20);
  });
  it("is deterministic and never mutates input data or preferences", () => {
    const data = fixture();
    data.recurring = [schedule()];
    const plan = input({ dailySpending: 1, scenarioDailySpending: 1 });
    const original = JSON.stringify({ data, plan });
    expect(simulatePurchase(data, plan)).toEqual(simulatePurchase(data, plan));
    expect(JSON.stringify({ data, plan })).toBe(original);
  });
});
