import { describe, expect, it } from "vitest";
import { accountBalance, exactSum, localDate, nextOccurrence, parseMoney, totalsByCurrency } from "@/lib/finance";

describe("exact monetary arithmetic", () => {
  it.each<[string, number]>([
    ["0", 0], ["0.01", 1], ["0.10", 10], ["1.23", 123],
    ["5000", 500_000], ["-12.05", -1205], ["١٢٣٫٤٥", 12_345],
    [" 2000.00 ", 200_000],
  ])("parses %s as %i minor units", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["", "1.001", "NaN", "Infinity", "1e3", "12abc", "1,000", "10000000000.01"])("rejects malformed or out-of-range money %s", input => {
    expect(() => parseMoney(input)).toThrow();
  });

  it("does not accumulate floating point errors", () => {
    expect(exactSum(Array.from({ length: 1000 }, () => parseMoney("0.01")))).toBe(1000);
    expect(exactSum([parseMoney("0.1"), parseMoney("0.2")])).toBe(30);
  });

  it("rejects unsafe sums and non-integer inputs", () => {
    expect(() => exactSum([1.1])).toThrow();
    expect(() => exactSum([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(() => exactSum([Number.MIN_SAFE_INTEGER, -1])).toThrow();
  });

  it("calculates the requested accounting example", () => {
    expect(accountBalance({ id: "bank", openingBalance: 500_000 }, [
      { accountId: "bank", kind: "income", amount: 200_000 },
      { accountId: "bank", kind: "expense", amount: 30_000 },
      { accountId: "other", kind: "income", amount: 900_000 },
    ], [])).toBe(670_000);
  });

  it("preserves separate totals for currencies with no exchange rate", () => {
    expect(totalsByCurrency([
      { currency: "ILS", balance: 100_000 }, { currency: "USD", balance: 20_000 },
      { currency: "ILS", balance: -10_000 }, { currency: "EUR", balance: 0 },
    ])).toEqual({ ILS: 90_000, USD: 20_000, EUR: 0 });
  });
});

describe("calendar scheduling", () => {
  it("clamps monthly recurrence to the last day of shorter months", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextOccurrence("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(nextOccurrence("2026-12-31", "monthly")).toBe("2027-01-31");
  });

  it("handles leap years and weekly year transitions", () => {
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-02-28");
    expect(nextOccurrence("2026-12-29", "weekly")).toBe("2027-01-05");
  });

  it("uses the user's time zone when computing the local day", () => {
    const now = new Date("2026-11-05T23:30:00Z");
    expect(localDate("Asia/Jerusalem", now)).toBe("2026-11-06");
    expect(localDate("America/New_York", now)).toBe("2026-11-05");
  });
});
