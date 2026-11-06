import { identity, errorResponse, noStore } from "@/server/http";
import { getSnapshot } from "@/server/finance-service";
import { ServiceError, dateSchema, currencySchema } from "@/server/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function GET(request: Request) {
  try {
    const user = await identity(request);
    const data = await getSnapshot(user.id);
    const params = new URL(request.url).searchParams;
    const format = params.get("format") || "csv";
    if (format === "json") return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), schemaVersion: 1, ...data }, null, 2), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="mizan-data.json"' } });
    if (format !== "csv") throw new ServiceError("Supported formats are csv and json.");
    const from = params.get("from") ? dateSchema.parse(params.get("from")) : null;
    const to = params.get("to") ? dateSchema.parse(params.get("to")) : null;
    const currency = params.get("currency") ? currencySchema.parse(params.get("currency")) : null;
    const accountId = params.get("accountId");
    if (accountId && !data.accounts.some(account => account.id === accountId)) throw new ServiceError("Account not found.", 404);
    if (from && to && from > to) throw new ServiceError("The start date must precede the end date.");
    const rows: unknown[][] = [["date", "kind", "amount", "currency", "account", "category", "note", "accountId", "categoryId"]];
    for (const transaction of data.transactions) {
      if ((from && transaction.date < from) || (to && transaction.date > to) || (currency && transaction.currency !== currency) || (accountId && transaction.accountId !== accountId)) continue;
      const amount = `${Math.floor(transaction.amount / 100)}.${String(transaction.amount % 100).padStart(2, "0")}`;
      rows.push([transaction.date, transaction.kind, amount, transaction.currency, data.accounts.find(account => account.id === transaction.accountId)?.name, data.categories.find(category => category.id === transaction.categoryId)?.name, transaction.note, transaction.accountId, transaction.categoryId]);
    }
    return new Response(`\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`, { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mizan-transactions.csv"' } });
  } catch (error) { return errorResponse(error); }
}
