import type { Currency, Snapshot } from "./contracts";
import { exactSum, nextOccurrence } from "./finance";

/** All monetary inputs and outputs use integer minor units. No ledger writes. */
export interface SimulationInput {
  currency: Currency;
  asOf: string;
  horizonDays: number;
  dailySpending: number;
  scenarioDailySpending: number;
  purchaseAmount: number;
  purchaseDate: string;
  buffer: number;
  protectGoals: boolean;
  excludedRecurringIds: string[];
}
export interface SimulationEvent {
  id: string;
  date: string;
  originalDate: string;
  name: string;
  kind: "income" | "expense";
  amount: number;
  source: "recorded" | "recurring";
  recurringId?: string;
}
export interface SimulationRow {
  date: string;
  income: number;
  expense: number;
  baselineDailySpending: number;
  scenarioDailySpending: number;
  purchase: number;
  baseline: number;
  scenario: number;
  delta: number;
}
export interface ProjectionSummary {
  endingBalance: number;
  minimumBalance: number;
  minimumDate: string;
  firstBreachDate: string | null;
}
export interface SimulationResult {
  currency: Currency;
  asOf: string;
  endDate: string;
  openingBalance: number;
  protectedGoals: number;
  reserveFloor: number;
  accountCount: number;
  events: SimulationEvent[];
  rows: SimulationRow[];
  baseline: ProjectionSummary;
  scenario: ProjectionSummary;
  delta: { endingBalance: number; minimumBalance: number };
  /** Ceiling after the chosen date, with the scenario's daily allowance, before this purchase. */
  purchaseCapacity: number;
  /** A purchase cannot fix a shortfall that already happens before its date. */
  prePurchaseBreach: boolean;
  overdueCount: number;
  futureContributionCount: number;
  possibleDuplicateRecurringIds: string[];
  possibleDuplicates: { recurringId: string; transactionId: string; date: string; amount: number; note: string }[];
}

export type SimulationErrorCode = "invalid-date" | "invalid-money" | "invalid-horizon" | "invalid-currency" | "invalid-data" | "no-accounts" | "stale-schedule" | "overflow";
export class SimulationError extends Error {
  constructor(public code: SimulationErrorCode) { super(code); this.name = "SimulationError"; }
}

function dateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "2199-12-31") return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function addDays(date: string, days: number): string {
  if (!dateValid(date) || !Number.isInteger(days)) throw new SimulationError("invalid-date");
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  if (!Number.isFinite(result.getTime())) throw new SimulationError("invalid-date");
  const value = result.toISOString().slice(0, 10);
  if (!dateValid(value)) throw new SimulationError("invalid-date");
  return value;
}
function assertMoney(value: number, allowNegative = false) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 1_000_000_000_000 || (!allowNegative && value < 0)) throw new SimulationError("invalid-money");
}
function total(values: number[]) {
  try { return exactSum(values); } catch { throw new SimulationError("overflow"); }
}
function unique<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new SimulationError("invalid-data");
    byId.set(item.id, item);
  }
  return [...byId.values()];
}
function summarize(rows: SimulationRow[], key: "baseline" | "scenario", floor: number): ProjectionSummary {
  const minimum = rows.reduce((lowest, row) => row[key] < lowest[key] ? row : lowest, rows[0]);
  return {
    endingBalance: rows.at(-1)![key], minimumBalance: minimum[key], minimumDate: minimum.date,
    firstBreachDate: rows.find(row => row[key] < floor)?.date ?? null,
  };
}

/**
 * Deterministic closing-balance model. All accounts of ONE currency are pooled.
 * Existing transfers cancel; goals define a floor, not an expense. Daily extra
 * spending starts tomorrow. Unposted overdue occurrences are projected today.
 */
export function simulatePurchase(data: Snapshot, input: SimulationInput): SimulationResult {
  if (!["ILS", "USD", "EUR"].includes(input.currency)) throw new SimulationError("invalid-currency");
  if (!dateValid(input.asOf) || !dateValid(input.purchaseDate)) throw new SimulationError("invalid-date");
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1 || input.horizonDays > 90) throw new SimulationError("invalid-horizon");
  for (const amount of [input.dailySpending, input.scenarioDailySpending, input.purchaseAmount, input.buffer]) assertMoney(amount);
  if (typeof input.protectGoals !== "boolean" || !Array.isArray(input.excludedRecurringIds)) throw new SimulationError("invalid-data");
  const endDate = addDays(input.asOf, input.horizonDays);
  if (input.purchaseDate < input.asOf || input.purchaseDate > endDate) throw new SimulationError("invalid-date");
  const accounts = unique(data.accounts).filter(account => account.currency === input.currency);
  if (!accounts.length) throw new SimulationError("no-accounts");
  accounts.forEach(account => assertMoney(account.openingBalance, true));
  const accountIds = new Set(accounts.map(account => account.id));
  const transactions = unique(data.transactions).filter(row => accountIds.has(row.accountId));
  for (const row of transactions) {
    assertMoney(row.amount);
    if (row.currency !== input.currency || !["income", "expense"].includes(row.kind) || !dateValid(row.date)) throw new SimulationError("invalid-data");
  }
  // Rebuild the as-of balance. Snapshot account.balance also includes future rows.
  const openingBalance = total([
    ...accounts.map(account => account.openingBalance),
    ...transactions.filter(row => row.date <= input.asOf).map(row => row.kind === "income" ? row.amount : -row.amount),
  ]);
  const goals = new Set(unique(data.goals).filter(goal => goal.currency === input.currency).map(goal => goal.id));
  const contributions = unique(data.contributions).filter(row => goals.has(row.goalId));
  for (const row of contributions) {
    assertMoney(row.amount);
    if (!dateValid(row.date) || !accountIds.has(row.accountId)) throw new SimulationError("invalid-data");
  }
  const protectedGoals = input.protectGoals ? total(contributions.filter(row => row.date <= input.asOf).map(row => row.amount)) : 0;
  const reserveFloor = total([input.buffer, protectedGoals]);
  const processed = new Set([...(data.processedRecurringKeys ?? []), ...transactions.flatMap(row => row.sourceKey ? [row.sourceKey] : [])]);
  const events: SimulationEvent[] = transactions.filter(row => row.date > input.asOf && row.date <= endDate).map(row => ({
    id: `transaction:${row.id}`, date: row.date, originalDate: row.date, name: row.note, kind: row.kind, amount: row.amount, source: "recorded",
  }));
  const excluded = new Set(input.excludedRecurringIds);
  const possibleDuplicates = new Set<string>();
  const overlaps: SimulationResult["possibleDuplicates"] = [];
  let overdueCount = 0;
  for (const schedule of unique(data.recurring)) {
    if (!schedule.active || !accountIds.has(schedule.accountId) || excluded.has(schedule.id)) continue;
    assertMoney(schedule.amount);
    if (schedule.currency !== input.currency || !dateValid(schedule.nextDate) || !["weekly", "monthly", "yearly"].includes(schedule.frequency) || !["income", "expense"].includes(schedule.kind)) throw new SimulationError("invalid-data");
    let date = schedule.nextDate;
    let count = 0;
    while (date <= endDate) {
      // Bound stale schedules without silently truncating their obligations.
      if (++count > 1000) throw new SimulationError("stale-schedule");
      const key = `recurring:${schedule.id}:${date}`;
      if (!processed.has(key)) {
        if (date < input.asOf) overdueCount++;
        for (const row of transactions.filter(row => !row.sourceKey?.startsWith("recurring:") && row.accountId === schedule.accountId && row.categoryId === schedule.categoryId && row.kind === schedule.kind && row.amount === schedule.amount && row.date === date)) {
          possibleDuplicates.add(schedule.id);
          overlaps.push({ recurringId: schedule.id, transactionId: row.id, date, amount: row.amount, note: row.note });
        }
        events.push({ id: key, date: date < input.asOf ? input.asOf : date, originalDate: date, name: schedule.name, kind: schedule.kind, amount: schedule.amount, source: "recurring", recurringId: schedule.id });
      }
      date = nextOccurrence(date, schedule.frequency);
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const byDate = new Map<string, SimulationEvent[]>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  const rows: SimulationRow[] = [];
  let baselineBalance = openingBalance, scenarioBalance = openingBalance;
  let capacity: number | undefined;
  let prePurchaseBreach = false;
  for (let day = 0; day <= input.horizonDays; day++) {
    const date = addDays(input.asOf, day);
    const dayEvents = byDate.get(date) ?? [];
    const income = total(dayEvents.filter(row => row.kind === "income").map(row => row.amount));
    const expense = total(dayEvents.filter(row => row.kind === "expense").map(row => row.amount));
    const baselineDailySpending = day === 0 ? 0 : input.dailySpending;
    const scenarioDailySpending = day === 0 ? 0 : input.scenarioDailySpending;
    const purchase = date === input.purchaseDate ? input.purchaseAmount : 0;
    baselineBalance = total([baselineBalance, income, -expense, -baselineDailySpending]);
    scenarioBalance = total([scenarioBalance, income, -expense, -scenarioDailySpending, -purchase]);
    // Undo this one-off purchase to measure available headroom for any purchase.
    const beforePurchaseEffect = total([scenarioBalance, date >= input.purchaseDate ? input.purchaseAmount : 0]);
    if (date >= input.purchaseDate) {
      const headroom = total([beforePurchaseEffect, -reserveFloor]);
      capacity = capacity === undefined ? headroom : Math.min(capacity, headroom);
    } else if (beforePurchaseEffect < reserveFloor) prePurchaseBreach = true;
    rows.push({ date, income, expense, baselineDailySpending, scenarioDailySpending, purchase, baseline: baselineBalance, scenario: scenarioBalance, delta: total([scenarioBalance, -baselineBalance]) });
  }
  const baseline = summarize(rows, "baseline", reserveFloor);
  const scenario = summarize(rows, "scenario", reserveFloor);
  return {
    currency: input.currency, asOf: input.asOf, endDate, openingBalance, protectedGoals, reserveFloor, accountCount: accounts.length,
    events, rows, baseline, scenario,
    delta: { endingBalance: total([scenario.endingBalance, -baseline.endingBalance]), minimumBalance: total([scenario.minimumBalance, -baseline.minimumBalance]) },
    purchaseCapacity: Math.max(0, capacity ?? 0), prePurchaseBreach, overdueCount,
    futureContributionCount: contributions.filter(row => row.date > input.asOf).length,
    possibleDuplicateRecurringIds: [...possibleDuplicates],
    possibleDuplicates: overlaps,
  };
}
