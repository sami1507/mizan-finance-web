export const CSV_COLUMNS = ["date", "kind", "amount", "accountId", "categoryId", "currency", "note"] as const;
export type CsvColumn = typeof CSV_COLUMNS[number];
export type CsvMapping = Record<CsvColumn, string>;

export const CSV_NOTE_ENCODING = "spreadsheet-safe-v1";
export function needsSpreadsheetEscape(value: string): boolean {
  return /^[\s]*[=+\-@\t\r]/.test(value);
}
// Only our explicit row marker authorizes decoding; an ordinary leading apostrophe is user data.
export function decodeCsvNote(value: string, encoding?: string): string {
  return encoding === CSV_NOTE_ENCODING && value.startsWith("'") && needsSpreadsheetEscape(value.slice(1)) ? value.slice(1) : value;
}

const aliases: Record<CsvColumn, string[]> = {
  date: ["date", "التاريخ", "datum", "תאריך"],
  kind: ["kind", "type", "النوع", "typ", "art", "סוג"],
  amount: ["amount", "المبلغ", "betrag", "סכום"],
  // Explicit identifiers outrank human-readable names, regardless of CSV column order.
  accountId: ["accountId", "konto-id", "konto_id", "מזהה חשבון", "account", "الحساب", "konto", "חשבון"],
  categoryId: ["categoryId", "kategorie-id", "kategorie_id", "מזהה קטגוריה", "category", "التصنيف", "kategorie", "קטגוריה"],
  currency: ["currency", "العملة", "währung", "waehrung", "מטבע"],
  note: ["note", "description", "الملاحظة", "الوصف", "notiz", "beschreibung", "הערה", "תיאור"],
};
const normalized = (value: string) => value.normalize("NFC").trim().toLowerCase();

export function mapCsvColumns(headers: string[]): CsvMapping {
  return Object.fromEntries(CSV_COLUMNS.map(column => [column,
    aliases[column].map(alias => headers.find(header => normalized(header) === normalized(alias))).find(Boolean) ?? "",
  ])) as CsvMapping;
}

export class CsvMappingError extends Error {
  constructor(public code: "ambiguous-account" | "ambiguous-category") { super(code); this.name = "CsvMappingError"; }
}

export function resolveCsvAccount<T extends { id: string; name: string }>(accounts: T[], value: string): T | undefined {
  const identifierMatch = accounts.find(account => account.id === value);
  if (identifierMatch) return identifierMatch;
  const matches = accounts.filter(account => account.name === value);
  if (matches.length > 1) throw new CsvMappingError("ambiguous-account");
  return matches[0];
}

export function resolveCsvCategory<T extends { id: string; kind: "income" | "expense" }>(categories: T[], value: string, kind: "income" | "expense", labels: (category: T) => string[]): T | undefined {
  const eligible = categories.filter(category => category.kind === kind);
  const identifierMatch = eligible.find(category => category.id === value);
  if (identifierMatch) return identifierMatch;
  const matches = eligible.filter(category => labels(category).some(label => normalized(label) === normalized(value)));
  if (matches.length > 1) throw new CsvMappingError("ambiguous-category");
  return matches[0];
}
