import type { Account, Transaction, Transfer, Currency } from "./contracts";

/** Exact money parsing: no floating-point multiplication, at most two fractional digits. */
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(/[٠-٩]/g, char => String("٠١٢٣٤٥٦٧٨٩".indexOf(char))).replace("٫", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Use an amount with up to two decimal places.");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount > 1000000000000n) throw new Error("Amount is too large.");
  return Number(negative ? -amount : amount);
}

export function exactSum(values: number[]): number {
  const total = values.reduce((sum, value) => {
    if (!Number.isSafeInteger(value)) throw new Error("Money must use integer minor units.");
    return sum + BigInt(value);
  }, 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("Total exceeds supported range.");
  return Number(total);
}

export function accountBalance(account: Pick<Account, "id" | "openingBalance">, transactions: Pick<Transaction, "accountId" | "kind" | "amount">[], transfers: Pick<Transfer, "fromAccountId" | "toAccountId" | "amount">[]): number {
  return exactSum([account.openingBalance, ...transactions.filter(item => item.accountId === account.id).map(item => item.kind === "income" ? item.amount : -item.amount), ...transfers.flatMap(item => item.fromAccountId === account.id ? [-item.amount] : item.toAccountId === account.id ? [item.amount] : [])]);
}

export function totalsByCurrency(accounts: Pick<Account, "currency" | "balance">[]): Partial<Record<Currency, number>> {
  return Object.fromEntries((["ILS", "USD", "EUR"] as const).filter(currency => accounts.some(account => account.currency === currency)).map(currency => [currency, exactSum(accounts.filter(account => account.currency === currency).map(account => account.balance))]));
}

export function localDate(timezone = "Asia/Jerusalem", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nextOccurrence(value: string, frequency: "weekly" | "monthly" | "yearly"): string {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDate();
  if (frequency === "weekly") date.setUTCDate(day + 7);
  else {
    date.setUTCDate(1);
    if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCFullYear(date.getUTCFullYear() + 1);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  }
  return date.toISOString().slice(0, 10);
}
