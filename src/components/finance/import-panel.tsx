"use client";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import type { Locale, Snapshot, Transaction } from "@/lib/contracts";
import { categoryLabel, dateLabel, minor, money } from "./utils";
import { localeTag } from "@/lib/i18n";
import { CSV_COLUMNS as columns, CsvMappingError, mapCsvColumns, resolveCsvAccount, resolveCsvCategory, type CsvColumn as Column, type CsvMapping as Mapping } from "@/lib/csv-mapping";

const labels: Record<Column, [string, string]> = { date: ["التاريخ", "Date"], kind: ["النوع", "Type"], amount: ["المبلغ", "Amount"], accountId: ["الحساب", "Account"], categoryId: ["التصنيف", "Category"], currency: ["العملة", "Currency"], note: ["الملاحظة", "Note"] };

export function ImportPanel({ data, locale, t, mutate, close }: { data: Snapshot; locale: Locale; t: (a: string, b: string, values?: Record<string, string | number>) => string; mutate: (body: Record<string, unknown>) => Promise<void>; close: () => void }) {
  const [source, setSource] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date: "", kind: "", amount: "", accountId: "", categoryId: "", currency: "", note: "" });
  const [account, setAccount] = useState(data.accounts[0]?.id || "");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(data.categories.find((c) => c.kind === "expense")?.id || "");
  const [filename, setFilename] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function fileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setError(""); setSource([]); setHeaders([]); setFilename("");
    if (file.size > 2 * 1024 * 1024) { setError(t("الحد الأقصى لحجم الملف ٢ ميغابايت", "Maximum file size is 2 MB")); return; }
    const result = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.replace(/^\uFEFF/, "").trim() });
    if (result.errors.length) { setError(t("تعذر قراءة الملف. تحقق من بنية CSV وعلامات الاقتباس.", "The CSV could not be parsed. Check its structure and quotation marks.")); return; }
    if (result.data.length > 2000) { setError(t("استورد ٢٠٠٠ صف كحد أقصى في كل مرة", "Import up to 2,000 rows at a time")); return; }
    const fields = result.meta.fields || [];
    setHeaders(fields); setSource(result.data); setFilename(file.name);
    setMapping(mapCsvColumns(fields));
  }
  const preview = useMemo(() => source.map((sourceRow, index) => {
    try {
      const get = (key: Column) => mapping[key] ? (sourceRow[mapping[key]] || "").trim() : "";
      const type = get("kind") || kind; const actualKind = ["income", "دخل", "einnahme", "einnahmen", "הכנסה", "הכנסות"].includes(type.toLowerCase()) ? "income" : ["expense", "مصروف", "ausgabe", "ausgaben", "הוצאה", "הוצאות"].includes(type.toLowerCase()) ? "expense" : null;
      if (!actualKind) throw new Error(t("نوع المعاملة غير صالح", "Invalid transaction type"));
      const accountValue = get("accountId") || account; const financialAccount = resolveCsvAccount(data.accounts, accountValue);
      if (!financialAccount) throw new Error(t("الحساب غير موجود", "Account not found"));
      const categoryValue = get("categoryId") || category; const cat = resolveCsvCategory(data.categories, categoryValue, actualKind, c => [c.name, c.nameAr, categoryLabel(data, c.id, "he"), categoryLabel(data, c.id, "de")]);
      if (!cat) throw new Error(t("التصنيف لا يطابق نوع المعاملة", "Category does not match transaction type"));
      const date = get("date"); const parsedDate = new Date(`${date}T12:00:00Z`); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date || date < "1900-01-01" || date > "2199-12-31") throw new Error(t("استخدم التاريخ YYYY-MM-DD", "Use date format YYYY-MM-DD"));
      const amount = minor(get("amount"), locale); if (amount <= 0) throw new Error(t("المبلغ يجب أن يكون موجبًا", "Amount must be positive"));
      const currency = get("currency") || financialAccount.currency; if (currency !== financialAccount.currency) throw new Error(t("العملة تختلف عن عملة الحساب", "Currency differs from account currency"));
      const row: Omit<Transaction, "id"> = { accountId: financialAccount.id, categoryId: cat.id, kind: actualKind, amount, currency: financialAccount.currency, date, note: get("note") };
      return { index, row, error: "" };
    } catch (err) {
      const message = err instanceof CsvMappingError
        ? err.code === "ambiguous-account"
          ? t("يوجد أكثر من حساب بهذا الاسم. اربط عمود معرّف الحساب أو اختر حسابًا افتراضيًا.", "More than one account matches this name. Map an account ID column or choose a default account.")
          : t("يوجد أكثر من تصنيف بهذا الاسم. اربط عمود معرّف التصنيف أو اختر تصنيفًا افتراضيًا.", "More than one category matches this label. Map a category ID column or choose a default category.")
        : err instanceof Error ? err.message : String(err);
      return { index, row: null, error: message };
    }
  }), [source, mapping, kind, account, category, data, t, locale]);
  const invalid = preview.filter((r) => r.error).length;
  const existing = new Set(data.transactions.map((r) => [r.accountId, r.categoryId, r.kind, r.amount, r.currency, r.date.slice(0, 10), r.note].join("|")));
  const duplicateIndices = new Set<number>();
  preview.forEach(({ row, index }) => { if (!row) return; const key = [row.accountId, row.categoryId, row.kind, row.amount, row.currency, row.date, row.note].join("|"); if (existing.has(key)) duplicateIndices.add(index); existing.add(key); });
  async function commit() { setBusy(true); setError(""); try { await mutate({ action: "import.commit", rows: preview.map((r) => r.row) }); close(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); } }
  return <section className="panel import-panel"><div className="panel-heading"><div><h2>{t("استيراد معاملات CSV", "Import transactions from CSV")}</h2><p>{t("اربط الأعمدة، راجع البيانات، ثم احفظها. لن تُحفظ أي بيانات قبل تأكيدك.", "Map your columns, review your data, then save. Nothing is saved before your confirmation.")}</p></div><button className="icon-button" aria-label={t("إغلاق", "Close")} onClick={close}><X size={18} /></button></div><div className="import-body"><label className="file-drop"><FileSpreadsheet size={28} /><strong>{filename || t("اختر ملف CSV", "Choose a CSV file")}</strong><span>{t("حتى ٢ ميغابايت · التاريخ YYYY-MM-DD · المبلغ بوحدات العملة الرئيسية", "Up to 2 MB · Date YYYY-MM-DD · Amounts in major currency units")}</span><input type="file" accept=".csv,text/csv" onChange={(e) => void fileChange(e)} /></label>{source.length > 0 && <><h3>{t("١. ربط الأعمدة", "1. Map columns")}</h3><div className="mapping-grid">{columns.map((column) => <label className="form-field" key={column}><span>{t(...labels[column])}{["date", "amount"].includes(column) ? " *" : ""}</span><select value={mapping[column]} onChange={(e) => setMapping({ ...mapping, [column]: e.target.value })}><option value="">{["date", "amount"].includes(column) ? t("اختر عمودًا", "Choose a column") : t("القيمة الافتراضية", "Use default")}</option>{headers.map((h) => <option key={h}>{h}</option>)}</select></label>)}</div><div className="mapping-defaults"><label className="form-field"><span>{t("الحساب الافتراضي", "Default account")}</span><select value={account} onChange={(e) => setAccount(e.target.value)}>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label><label className="form-field"><span>{t("النوع الافتراضي", "Default type")}</span><select value={kind} onChange={(e) => { setKind(e.target.value as "income" | "expense"); setCategory(data.categories.find((c) => c.kind === e.target.value)?.id || ""); }}><option value="expense">{t("مصروف", "Expense")}</option><option value="income">{t("دخل", "Income")}</option></select></label><label className="form-field"><span>{t("التصنيف الافتراضي", "Default category")}</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{data.categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{categoryLabel(data, c.id, locale)}</option>)}</select></label></div><h3>{t("٢. معاينة وتحقق", "2. Preview and validate")}</h3><div className="import-summary"><span><CheckCircle2 size={16} />{new Intl.NumberFormat(localeTag(locale)).format(source.length - invalid)} {t("صف صالح", "valid rows")}</span><span><AlertCircle size={16} />{new Intl.NumberFormat(localeTag(locale)).format(invalid)} {t("صف يحتاج تعديلًا", "rows need attention")}</span><span>{new Intl.NumberFormat(localeTag(locale)).format(duplicateIndices.size)} {t("مكرر سيُتجاوز", "duplicates will be skipped")}</span></div><div className="table-scroll import-preview"><table><thead><tr><th>#</th><th>{t("التاريخ", "Date")}</th><th>{t("التصنيف", "Category")}</th><th>{t("المبلغ", "Amount")}</th><th>{t("الحالة", "Status")}</th></tr></thead><tbody>{preview.slice(0, 50).map(({ index, row, error: rowError }) => <tr key={index}><td>{new Intl.NumberFormat(localeTag(locale)).format(index + 1)}</td>{row ? <><td><time dateTime={row.date}>{dateLabel(row.date, locale, data.profile.timezone)}</time></td><td>{categoryLabel(data, row.categoryId, locale)}</td><td>{money(row.amount, row.currency, locale)}</td><td>{duplicateIndices.has(index) ? t("مكرر — سيُتجاوز", "Duplicate — will skip") : t("جاهز", "Ready")}</td></> : <td colSpan={4} className="danger-text">{rowError}</td>}</tr>)}</tbody></table></div>{source.length > 50 && <p className="subtle-note">{t("تُعرض أول ٥٠ صفًا فقط؛ تُفحص جميع الصفوف قبل الحفظ.", "Showing the first 50 rows; all rows are validated before saving.")}</p>}<button className="btn btn-primary" disabled={busy || invalid > 0 || !mapping.date || !mapping.amount} onClick={() => void commit()}><Upload size={17} />{busy ? t("جارٍ الاستيراد…", "Importing…") : t("تأكيد استيراد {count} معاملة", "Confirm import of {count} transactions", { count: source.length - duplicateIndices.size })}</button></>}{error && <p className="form-error" role="alert">{error}</p>}</div></section>;
}
