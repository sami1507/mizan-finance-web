import type { Currency, Snapshot } from "./contracts";

/** Money is always expressed in integer minor units (agorot/cents). */
export interface SavingsExpense {
  id: string;
  amount: number;
}

export interface SavingsCapacityInput {
  income: number;
  expenses: ReadonlyArray<SavingsExpense>;
  reserve: number;
}

export interface SavingsCapacityResult {
  income: number;
  expenseTotal: number;
  reserve: number;
  net: number;
  maximumSavings: number;
  deficit: number;
  afterReserve: number;
  reserveShortfall: number;
  /** 3750 basis points = 37.5%. Null when income is zero. */
  savingsRateBasisPoints: number | null;
}

export interface RecordedExpenseGroup extends SavingsExpense {
  categoryId: string;
  transactionCount: number;
}

export interface RecordedMonthlySavings {
  month: string;
  currency: Currency;
  income: number;
  expenseTotal: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  expenses: RecordedExpenseGroup[];
}

export type SavingsCapacityErrorCode = "invalid-money" | "invalid-id" | "duplicate-id" | "overflow" | "invalid-month" | "invalid-currency" | "invalid-data";

export class SavingsCapacityError extends Error {
  constructor(public code: SavingsCapacityErrorCode) {
    super(code);
    this.name = "SavingsCapacityError";
  }
}

const maximumSafe = BigInt(Number.MAX_SAFE_INTEGER);

function money(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0) throw new SavingsCapacityError("invalid-money");
  return BigInt(value);
}

function safeNumber(value: bigint): number {
  if (value > maximumSafe || value < -maximumSafe) throw new SavingsCapacityError("overflow");
  return Number(value);
}

function requireId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) throw new SavingsCapacityError("invalid-id");
}

function nonnegative(value: bigint): bigint { return value > 0n ? value : 0n; }

/** A monthly arithmetic plan, not a forecast or permission to spend account balances. */
export function calculateSavingsCapacity(input: SavingsCapacityInput): SavingsCapacityResult {
  if (!input || !Array.isArray(input.expenses)) throw new SavingsCapacityError("invalid-data");
  const income = money(input.income);
  const reserve = money(input.reserve);
  const ids = new Set<string>();
  let expenseTotal = 0n;
  for (const expense of input.expenses) {
    if (!expense) throw new SavingsCapacityError("invalid-data");
    requireId(expense.id);
    if (ids.has(expense.id)) throw new SavingsCapacityError("duplicate-id");
    ids.add(expense.id);
    expenseTotal += money(expense.amount);
  }
  const net = income - expenseTotal;
  const maximumSavings = nonnegative(net);
  // Integer half-up rounding; even a very large safe income never multiplies as a float.
  const rate = income > 0n ? (maximumSavings * 10_000n * 2n + income) / (income * 2n) : null;
  return {
    income: safeNumber(income), expenseTotal: safeNumber(expenseTotal), reserve: safeNumber(reserve),
    net: safeNumber(net), maximumSavings: safeNumber(maximumSavings), deficit: safeNumber(nonnegative(-net)),
    afterReserve: safeNumber(nonnegative(net - reserve)),
    reserveShortfall: safeNumber(nonnegative(reserve - maximumSavings)),
    savingsRateBasisPoints: rate === null ? null : safeNumber(rate),
  };
}

function validMonth(month: string): boolean {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= "1900-01" && month <= "2199-12";
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/**
 * Reads the full selected calendar month from an already owner-scoped snapshot.
 * Future-dated recorded rows in that month are included; unrecorded schedules,
 * balances, transfers and goal allocations are not income or expenses here.
 * Only selected currency/month rows undergo ledger validation. A malformed date
 * without a recognizable month in the selected currency cannot be scoped and fails.
 */
export function recordedMonthlySavings(snapshot: Snapshot, month: string, currency: Currency): RecordedMonthlySavings {
  if (!validMonth(month)) throw new SavingsCapacityError("invalid-month");
  if (!["ILS", "USD", "EUR"].includes(currency)) throw new SavingsCapacityError("invalid-currency");
  if (!snapshot || !Array.isArray(snapshot.accounts) || !Array.isArray(snapshot.categories) || !Array.isArray(snapshot.transactions)) throw new SavingsCapacityError("invalid-data");
  const transactionIds = new Set<string>();
  const groups = new Map<string, { amount: bigint; transactionCount: number }>();
  let income = 0n, expenseTotal = 0n, incomeCount = 0, expenseCount = 0;
  for (const row of snapshot.transactions) {
    if (!row) throw new SavingsCapacityError("invalid-data");
    if (row.currency !== currency) continue;
    if (typeof row.date !== "string" || !validMonth(row.date.slice(0, 7))) throw new SavingsCapacityError("invalid-data");
    if (row.date.slice(0, 7) !== month) continue;
    if (!validDate(row.date) || (row.kind !== "income" && row.kind !== "expense")) throw new SavingsCapacityError("invalid-data");
    requireId(row.id);
    requireId(row.accountId);
    requireId(row.categoryId);
    if (transactionIds.has(row.id)) throw new SavingsCapacityError("duplicate-id");
    transactionIds.add(row.id);
    const accounts = snapshot.accounts.filter(account => account?.id === row.accountId);
    const categories = snapshot.categories.filter(category => category?.id === row.categoryId);
    if (accounts.length !== 1 || accounts[0].currency !== currency || categories.length !== 1 || categories[0].kind !== row.kind) throw new SavingsCapacityError("invalid-data");
    const amount = money(row.amount);
    // Recorded financial transactions follow the server's strictly positive amount rule.
    if (amount === 0n) throw new SavingsCapacityError("invalid-money");
    if (row.kind === "income") {
      income += amount;
      incomeCount++;
    } else {
      expenseTotal += amount;
      expenseCount++;
      const group = groups.get(row.categoryId) ?? { amount: 0n, transactionCount: 0 };
      groups.set(row.categoryId, { amount: group.amount + amount, transactionCount: group.transactionCount + 1 });
    }
  }
  const expenses = [...groups.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([categoryId, group]) => ({
    id: categoryId, categoryId, amount: safeNumber(group.amount), transactionCount: group.transactionCount,
  }));
  return {
    month, currency, income: safeNumber(income), expenseTotal: safeNumber(expenseTotal),
    transactionCount: incomeCount + expenseCount, incomeCount, expenseCount, expenses,
  };
}
