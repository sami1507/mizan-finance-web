import { describe, expect, it } from "vitest";
import type { Currency, Snapshot, Transaction } from "@/lib/contracts";
import {
  calculateSavingsCapacity, recordedMonthlySavings, SavingsCapacityError,
  type SavingsCapacityErrorCode, type SavingsCapacityInput,
} from "@/lib/savings-capacity";

const month = "2026-11";
const maximumSafe = Number.MAX_SAFE_INTEGER;

function fixture(): Snapshot {
  return {
    profile: { id: "owner", name: "Test", email: "test@example.test", locale: "en", currency: "ILS", timezone: "Asia/Jerusalem", onboarded: true },
    accounts: [
      { id: "bank", name: "Bank", type: "bank", currency: "ILS", openingBalance: 5_000_000, balance: 8_000_000 },
      { id: "cash", name: "Cash", type: "cash", currency: "ILS", openingBalance: 500_000, balance: 900_000 },
      { id: "usd", name: "USD", type: "bank", currency: "USD", openingBalance: 9_000_000, balance: 9_000_000 },
    ],
    categories: [
      { id: "salary", name: "Salary", nameAr: "راتب", kind: "income", color: "#000000" },
      { id: "rent", name: "Rent", nameAr: "إيجار", kind: "expense", color: "#000000" },
      { id: "food", name: "Food", nameAr: "طعام", kind: "expense", color: "#000000" },
    ],
    transactions: [], transfers: [], budgets: [], goals: [], contributions: [], recurring: [], notes: [], demo: false,
  };
}

function transaction(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return { id, accountId: "bank", categoryId: "food", kind: "expense", amount: 100, currency: "ILS", date: "2026-11-01", note: "", ...overrides };
}

function plan(overrides: Partial<SavingsCapacityInput> = {}): SavingsCapacityInput {
  return { income: 800_000, expenses: [{ id: "rent", amount: 300_000 }, { id: "food", amount: 200_000 }], reserve: 50_000, ...overrides };
}

function expectCode(run: () => unknown, code: SavingsCapacityErrorCode): void {
  expect(run).toThrow(SavingsCapacityError);
  expect(run).toThrow(code);
}

describe("monthly savings: independent arithmetic examples", () => {
  it("calculates 8,000 minus 5,000 as 3,000, 37.5%, and 2,500 after a 500 reserve", () => {
    expect(calculateSavingsCapacity(plan())).toEqual({
      income: 800_000, expenseTotal: 500_000, reserve: 50_000, net: 300_000,
      maximumSavings: 300_000, deficit: 0, afterReserve: 250_000,
      reserveShortfall: 0, savingsRateBasisPoints: 3750,
    });
  });

  it("shows a deficit and reserve shortfall separately without negative savings", () => {
    expect(calculateSavingsCapacity(plan({ income: 100, expenses: [{ id: "expense", amount: 150 }], reserve: 20 }))).toMatchObject({
      net: -50, maximumSavings: 0, deficit: 50, afterReserve: 0, reserveShortfall: 20, savingsRateBasisPoints: 0,
    });
  });

  it("treats reserve as an allocation and reports any uncovered portion", () => {
    expect(calculateSavingsCapacity(plan({ reserve: 350_000 }))).toMatchObject({
      expenseTotal: 500_000, net: 300_000, maximumSavings: 300_000,
      afterReserve: 0, reserveShortfall: 50_000, savingsRateBasisPoints: 3750,
    });
  });

  it("supports an empty zero-income plan without a fabricated percentage", () => {
    expect(calculateSavingsCapacity(plan({ income: 0, expenses: [], reserve: 0 }))).toEqual({
      income: 0, expenseTotal: 0, reserve: 0, net: 0, maximumSavings: 0,
      deficit: 0, afterReserve: 0, reserveShortfall: 0, savingsRateBasisPoints: null,
    });
    expect(calculateSavingsCapacity(plan({ income: 0, expenses: [{ id: "rent", amount: 100 }], reserve: 30 }))).toMatchObject({
      deficit: 100, reserveShortfall: 30, savingsRateBasisPoints: null,
    });
  });

  it("accepts zero-valued manual rows and a 100% savings rate", () => {
    expect(calculateSavingsCapacity(plan({ income: 100, expenses: [{ id: "unused", amount: 0 }], reserve: 0 }))).toMatchObject({
      expenseTotal: 0, maximumSavings: 100, afterReserve: 100, savingsRateBasisPoints: 10_000,
    });
  });

  it.each([
    [32, 31, 313], // 312.5 basis points rounds half-up.
    [3, 2, 3333],
    [6, 5, 1667],
  ])("rounds the rate for income %i and expenses %i to %i basis points", (income, amount, expected) => {
    expect(calculateSavingsCapacity(plan({ income, expenses: [{ id: "expense", amount }], reserve: 0 })).savingsRateBasisPoints).toBe(expected);
  });

  it("calculates at the safe-integer boundary without overflowing intermediate ratios", () => {
    expect(calculateSavingsCapacity(plan({ income: maximumSafe, expenses: [], reserve: 0 }))).toMatchObject({
      maximumSavings: maximumSafe, afterReserve: maximumSafe, savingsRateBasisPoints: 10_000,
    });
    expect(calculateSavingsCapacity(plan({ income: maximumSafe, expenses: [{ id: "all", amount: maximumSafe }], reserve: maximumSafe }))).toMatchObject({
      net: 0, maximumSavings: 0, afterReserve: 0, reserveShortfall: maximumSafe,
    });
    expect(calculateSavingsCapacity(plan({ income: 0, expenses: [{ id: "all", amount: maximumSafe }], reserve: maximumSafe }))).toMatchObject({
      net: -maximumSafe, deficit: maximumSafe, afterReserve: 0, reserveShortfall: maximumSafe,
    });
  });

  it("sums minor units exactly across many small rows", () => {
    const expenses = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), amount: 1 }));
    expect(calculateSavingsCapacity(plan({ income: 1333, expenses, reserve: 33 }))).toMatchObject({
      expenseTotal: 1000, maximumSavings: 333, afterReserve: 300,
    });
  });

  it.each([-1, 0.5, NaN, Infinity, maximumSafe + 1, "100"])("rejects invalid money %s in each input field", value => {
    const invalid = value as number;
    expectCode(() => calculateSavingsCapacity(plan({ income: invalid })), "invalid-money");
    expectCode(() => calculateSavingsCapacity(plan({ reserve: invalid })), "invalid-money");
    expectCode(() => calculateSavingsCapacity(plan({ expenses: [{ id: "bad", amount: invalid }] })), "invalid-money");
  });

  it("rejects expense totals beyond the safe range even when income offsets them", () => {
    expectCode(() => calculateSavingsCapacity(plan({ income: maximumSafe, expenses: [{ id: "a", amount: maximumSafe }, { id: "b", amount: 1 }] })), "overflow");
  });

  it("rejects blank and duplicate expense identities", () => {
    for (const id of ["", "  "]) expectCode(() => calculateSavingsCapacity(plan({ expenses: [{ id, amount: 1 }] })), "invalid-id");
    expectCode(() => calculateSavingsCapacity(plan({ expenses: [{ id: "same", amount: 1 }, { id: "same", amount: 2 }] })), "duplicate-id");
  });

  it("rejects malformed runtime inputs", () => {
    expectCode(() => calculateSavingsCapacity(null as unknown as SavingsCapacityInput), "invalid-data");
    expectCode(() => calculateSavingsCapacity({ ...plan(), expenses: null } as unknown as SavingsCapacityInput), "invalid-data");
    expectCode(() => calculateSavingsCapacity({ ...plan(), expenses: [null] } as unknown as SavingsCapacityInput), "invalid-data");
  });

  it("does not mutate inputs and gives the same result on repeated calculation", () => {
    const input = plan();
    input.expenses.forEach(Object.freeze);
    Object.freeze(input.expenses);
    Object.freeze(input);
    const before = JSON.stringify(input);
    expect(calculateSavingsCapacity(input)).toEqual(calculateSavingsCapacity(input));
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("recorded month: scope and grouping", () => {
  it("groups recorded expenses by stable category IDs and imports directly into the calculator", () => {
    const snapshot = fixture();
    snapshot.transactions = [
      transaction("salary", { kind: "income", categoryId: "salary", amount: 800_000 }),
      transaction("rent", { categoryId: "rent", amount: 300_000 }),
      transaction("food-1", { amount: 150_000 }),
      transaction("food-2", { amount: 50_000, accountId: "cash", date: "2026-11-30" }),
    ];
    const imported = recordedMonthlySavings(snapshot, month, "ILS");
    expect(imported).toEqual({
      month, currency: "ILS", income: 800_000, expenseTotal: 500_000,
      transactionCount: 4, incomeCount: 1, expenseCount: 3,
      expenses: [
        { id: "food", categoryId: "food", amount: 200_000, transactionCount: 2 },
        { id: "rent", categoryId: "rent", amount: 300_000, transactionCount: 1 },
      ],
    });
    expect(calculateSavingsCapacity({ income: imported.income, expenses: imported.expenses, reserve: 50_000 })).toEqual(calculateSavingsCapacity(plan()));
  });

  it("reads the full selected month, including persisted last-day entries, without forecasting schedules", () => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("recorded", { date: "2026-11-30", amount: 250, sourceKey: "recurring:r:2026-11-30" })];
    snapshot.recurring = [{ id: "r", name: "Scheduled", accountId: "bank", categoryId: "food", kind: "expense", amount: 250, currency: "ILS", frequency: "monthly", nextDate: "2026-11-30", active: true }];
    snapshot.processedRecurringKeys = ["recurring:r:2026-11-30"];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toMatchObject({ expenseTotal: 250, transactionCount: 1 });
  });

  it("excludes balances, transfers, goal allocations, and budgets from income and expenses", () => {
    const snapshot = fixture();
    snapshot.transfers = [{ id: "transfer", fromAccountId: "bank", toAccountId: "cash", amount: 100_000, date: "2026-11-01", note: "" }];
    snapshot.goals = [{ id: "goal", name: "Goal", target: 100_000, currency: "ILS", deadline: "2026-11-30", saved: 50_000 }];
    snapshot.contributions = [{ id: "allocation", goalId: "goal", accountId: "bank", amount: 50_000, date: "2026-11-01" }];
    snapshot.budgets = [{ id: "budget", categoryId: "food", month, amount: 300_000, currency: "ILS", spent: 99_000 }];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toEqual({ month, currency: "ILS", income: 0, expenseTotal: 0, transactionCount: 0, incomeCount: 0, expenseCount: 0, expenses: [] });
  });

  it("keeps currencies and calendar months separate", () => {
    const snapshot = fixture();
    snapshot.transactions = [
      transaction("ils", { amount: 100 }),
      transaction("usd", { accountId: "usd", currency: "USD", amount: 900 }),
      transaction("before", { amount: 200, date: "2026-10-31" }),
      transaction("after", { amount: 300, date: "2026-12-01" }),
    ];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toMatchObject({ expenseTotal: 100, transactionCount: 1 });
    expect(recordedMonthlySavings(snapshot, month, "USD")).toMatchObject({ expenseTotal: 900, transactionCount: 1 });
    expect(recordedMonthlySavings(snapshot, month, "EUR")).toMatchObject({ expenseTotal: 0, transactionCount: 0 });
  });

  it("ignores malformed foreign-currency rows and recognizable out-of-month rows", () => {
    const snapshot = fixture();
    snapshot.transactions = [
      transaction("valid", { amount: 10 }),
      transaction("foreign", { currency: "USD", accountId: "missing", amount: NaN, date: "not-a-date" }),
      transaction("other-month", { accountId: "missing", amount: -1, date: "2026-02-31" }),
    ];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toMatchObject({ expenseTotal: 10, transactionCount: 1 });
  });

  it("rejects duplicate selected identities but does not conflate distinct equal transactions", () => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("first"), transaction("second")];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toMatchObject({ expenseTotal: 200, transactionCount: 2 });
    snapshot.transactions.push(transaction("first"));
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "duplicate-id");
  });

  it("scopes identity checks to the selected month and currency", () => {
    const snapshot = fixture();
    snapshot.transactions = [
      transaction("same"), transaction("same", { date: "2026-10-01" }),
      transaction("same", { accountId: "usd", currency: "USD" }),
    ];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toMatchObject({ expenseTotal: 100, transactionCount: 1 });
  });

  it("does not mutate the snapshot or depend on transaction order", () => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("rent", { categoryId: "rent" }), transaction("food")];
    const original = structuredClone(snapshot);
    const first = recordedMonthlySavings(snapshot, month, "ILS");
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toEqual(first);
    expect(snapshot).toEqual(original);
    expect(recordedMonthlySavings({ ...snapshot, transactions: [...snapshot.transactions].reverse() }, month, "ILS")).toEqual(first);
  });
});

describe("recorded month: invalid data and exact boundaries", () => {
  it.each(["", "2026-00", "2026-13", "2026-2", "2026-02-01", "1899-12", "2200-01"])("rejects invalid month %s", invalidMonth => {
    expectCode(() => recordedMonthlySavings(fixture(), invalidMonth, "ILS"), "invalid-month");
  });

  it("rejects unsupported currency and malformed snapshot collections", () => {
    expectCode(() => recordedMonthlySavings(fixture(), month, "GBP" as Currency), "invalid-currency");
    expectCode(() => recordedMonthlySavings({ ...fixture(), transactions: null } as unknown as Snapshot, month, "ILS"), "invalid-data");
  });

  it.each(["2026-11-31", "2026-11-00", "2026-11-1", "2026-11-01T00:00:00Z", "not-a-date"])("rejects malformed selected date %s", date => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("invalid", { date })];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-data");
  });

  it("validates February including leap years and century rules", () => {
    for (const [date, valid] of [["2028-02-29", true], ["2000-02-29", true], ["2026-02-29", false], ["2100-02-29", false]] as const) {
      const snapshot = fixture();
      snapshot.transactions = [transaction("february", { date })];
      if (valid) expect(recordedMonthlySavings(snapshot, date.slice(0, 7), "ILS").transactionCount).toBe(1);
      else expectCode(() => recordedMonthlySavings(snapshot, date.slice(0, 7), "ILS"), "invalid-data");
    }
  });

  it.each([0, -1, 0.5, NaN, Infinity, maximumSafe + 1])("rejects invalid recorded amount %s", amount => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("invalid", { amount })];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-money");
  });

  it("requires selected transactions to reference a unique owned account in the same currency", () => {
    const snapshot = fixture();
    for (const accountId of ["foreign-account", "usd"]) {
      snapshot.transactions = [transaction("invalid", { accountId })];
      expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-data");
    }
    snapshot.transactions = [transaction("invalid")];
    snapshot.accounts.push({ ...snapshot.accounts[0] });
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-data");
  });

  it("requires selected transactions to reference a unique category matching their kind", () => {
    const snapshot = fixture();
    for (const categoryId of ["missing", "salary"]) {
      snapshot.transactions = [transaction("invalid", { categoryId })];
      expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-data");
    }
    snapshot.transactions = [transaction("invalid")];
    snapshot.categories.push({ ...snapshot.categories[2] });
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-data");
  });

  it("rejects blank selected transaction IDs and invalid kinds", () => {
    const snapshot = fixture();
    snapshot.transactions = [transaction(" ")];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-id");
    snapshot.transactions = [transaction("invalid", { kind: "transfer" as Transaction["kind"] })];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "invalid-data");
  });

  it("allows exact safe-boundary income and expense totals", () => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("income", { kind: "income", categoryId: "salary", amount: maximumSafe }), transaction("expense", { amount: maximumSafe })];
    expect(recordedMonthlySavings(snapshot, month, "ILS")).toMatchObject({ income: maximumSafe, expenseTotal: maximumSafe });
  });

  it("rejects overflowing income, expense totals, and category groups", () => {
    const snapshot = fixture();
    snapshot.transactions = [transaction("a", { kind: "income", categoryId: "salary", amount: maximumSafe }), transaction("b", { kind: "income", categoryId: "salary", amount: 1 })];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "overflow");
    snapshot.transactions = [transaction("a", { amount: maximumSafe }), transaction("b", { categoryId: "rent", amount: 1 })];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "overflow");
    snapshot.transactions = [transaction("a", { amount: maximumSafe }), transaction("b", { amount: 1 })];
    expectCode(() => recordedMonthlySavings(snapshot, month, "ILS"), "overflow");
  });
});
