import { describe, expect, it } from "vitest";
import { CsvMappingError, mapCsvColumns, resolveCsvAccount, resolveCsvCategory } from "@/lib/csv-mapping";

describe("CSV identifiers and localized column mapping", () => {
  const accounts = [
    { id: "cash-id", name: "Everyday", currency: "ILS" },
    { id: "bank-id", name: "Everyday", currency: "EUR" },
  ];

  it("prefers explicit account/category IDs in the application's own exported column order", () => {
    const mapping = mapCsvColumns(["date", "kind", "amount", "currency", "account", "category", "note", "accountId", "categoryId"]);
    expect(mapping.accountId).toBe("accountId");
    expect(mapping.categoryId).toBe("categoryId");
    const row: Record<string, string> = { account: "Everyday", accountId: "bank-id" };
    expect(resolveCsvAccount(accounts, row[mapping.accountId])).toBe(accounts[1]);
  });

  it("rejects an ambiguous name instead of choosing the first account", () => {
    expect(() => resolveCsvAccount(accounts, "Everyday")).toThrow(CsvMappingError);
    expect(() => resolveCsvAccount(accounts, "Everyday")).toThrow("ambiguous-account");
    expect(resolveCsvAccount(accounts, "missing")).toBeUndefined();
    expect(resolveCsvAccount([{ id: "id", name: "Müller · שלום" }], "Müller · שלום")?.id).toBe("id");
  });

  it("prioritizes opaque IDs even when another account uses an ID as its name", () => {
    const rows = [{ id: "other", name: "cash-id" }, ...accounts];
    expect(resolveCsvAccount(rows, "cash-id")).toBe(accounts[0]);
  });

  it("recognizes German and Hebrew aliases and prefers localized ID columns", () => {
    const german = mapCsvColumns(["Datum", "Typ", "Betrag", "Konto", "Konto-ID", "Kategorie", "Kategorie-ID", "Wa\u0308hrung", "Beschreibung"]);
    expect(german).toEqual({ date: "Datum", kind: "Typ", amount: "Betrag", accountId: "Konto-ID", categoryId: "Kategorie-ID", currency: "Wa\u0308hrung", note: "Beschreibung" });
    const hebrew = mapCsvColumns(["תאריך", "סוג", "סכום", "חשבון", "מזהה חשבון", "קטגוריה", "מזהה קטגוריה", "מטבע", "הערה"]);
    expect(hebrew).toEqual({ date: "תאריך", kind: "סוג", amount: "סכום", accountId: "מזהה חשבון", categoryId: "מזהה קטגוריה", currency: "מטבע", note: "הערה" });
  });

  it("resolves categories by ID first and refuses ambiguous localized labels", () => {
    const categories = [{ id: "one", kind: "expense" as const, label: "Lebensmittel" }, { id: "two", kind: "expense" as const, label: "Lebensmittel" }];
    expect(resolveCsvCategory(categories, "two", "expense", category => [category.label])).toBe(categories[1]);
    expect(() => resolveCsvCategory(categories, "Lebensmittel", "expense", category => [category.label])).toThrow("ambiguous-category");
    expect(resolveCsvCategory(categories, "one", "income", category => [category.label])).toBeUndefined();
  });
});
