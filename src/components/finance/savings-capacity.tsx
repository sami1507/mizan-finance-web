"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowDownToLine, Calculator, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Currency, Locale, Snapshot } from "@/lib/contracts";
import { localeTag, type Translator } from "@/lib/i18n";
import { calculateSavingsCapacity, recordedMonthlySavings, type RecordedMonthlySavings, type SavingsCapacityResult } from "@/lib/savings-capacity";
import { categoryLabel, major, minor, money, thisMonth } from "./utils";
import "./savings-capacity.css";

interface Props { data: Snapshot; locale: Locale; currency: Currency; t: Translator; }
interface ExpenseRow { id: string; label: string; amount: string; categoryId?: string; }
interface RecordedSource { month: string; transactionCount: number; incomeCount: number; expenseCount: number; edited: boolean; }

export default function SavingsCapacity({ data, locale, currency, t }: Props) {
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([{ id: "expense-0", label: "", amount: "" }]);
  const [reserve, setReserve] = useState("0");
  const [nextId, setNextId] = useState(1);
  const [month, setMonth] = useState(() => thisMonth(data.profile.timezone));
  const [source, setSource] = useState<RecordedSource | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [touched, setTouched] = useState<string[]>([]);
  const [previousLocale, setPreviousLocale] = useState(locale);
  if (previousLocale !== locale) {
    const reformat = (raw: string) => {
      if (!raw.trim()) return raw;
      try { const value = minor(raw, previousLocale); return value < 0 ? raw : major(value, locale); }
      catch { return raw; }
    };
    setPreviousLocale(locale);
    setIncome(reformat(income));
    setReserve(reformat(reserve));
    setExpenses(expenses.map(row => ({ ...row, amount: reformat(row.amount) })));
  }

  const currentMonth = thisMonth(data.profile.timezone);
  const monthValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= "1900-01" && month <= "2199-12";
  const errors: Record<string, string> = {};
  function parse(raw: string, key: string): number | undefined {
    if (!raw.trim()) {
      if (touched.includes(key)) errors[key] = t("أدخل مبلغًا، أو صفرًا إذا لم يوجد.", "Enter an amount, or zero if none.");
      return undefined;
    }
    try { const value = minor(raw, locale); if (value < 0) throw new Error(); return value; }
    catch (error) { errors[key] = error instanceof Error && error.message ? error.message : t("أدخل مبلغًا غير سالب بمنزلتين عشريتين كحد أقصى.", "Enter a non-negative amount with up to two decimal places."); return undefined; }
  }
  const incomeAmount = parse(income, "income");
  const reserveAmount = parse(reserve, "reserve");
  const parsedExpenses = expenses.map(row => ({ id: row.id, amount: parse(row.amount, row.id) }));
  let result: SavingsCapacityResult | null = null;
  let calculationError = false;
  if (incomeAmount !== undefined && reserveAmount !== undefined && parsedExpenses.every(row => row.amount !== undefined)) {
    try { result = calculateSavingsCapacity({ income: incomeAmount, expenses: parsedExpenses.map(row => ({ id: row.id, amount: row.amount! })), reserve: reserveAmount }); }
    catch { calculationError = true; }
  }
  const count = (value: number) => new Intl.NumberFormat(localeTag(locale)).format(value);
  const formatMonth = (value: string) => new Intl.DateTimeFormat(localeTag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
  const amount = (value: number) => money(value, currency, locale);
  function touch(key: string) { setTouched(previous => previous.includes(key) ? previous : [...previous, key]); }
  function markEdited() { setSource(previous => previous ? { ...previous, edited: true } : null); }
  function editExpense(id: string, update: Partial<ExpenseRow>) {
    setExpenses(previous => previous.map(row => row.id === id ? { ...row, ...update } : row));
    markEdited();
  }
  function addExpense() {
    setExpenses(previous => [...previous, { id: `expense-${nextId}`, label: "", amount: "" }]);
    setNextId(nextId + 1); markEdited();
  }
  function reset() {
    setIncome(""); setExpenses([{ id: "expense-0", label: "", amount: "" }]); setReserve("0"); setNextId(1);
    setMonth(currentMonth); setSource(null); setTouched([]); setLoadError(false);
  }
  function useRecordedMonth() {
    setLoadError(false);
    if (!monthValid) return;
    let recorded: RecordedMonthlySavings;
    try { recorded = recordedMonthlySavings(data, month, currency); }
    catch { setLoadError(true); return; }
    setTouched([]);
    setSource({ month: recorded.month, transactionCount: recorded.transactionCount, incomeCount: recorded.incomeCount, expenseCount: recorded.expenseCount, edited: false });
    if (!recorded.transactionCount) {
      setIncome(""); setExpenses([{ id: "expense-0", label: "", amount: "" }]); setNextId(1);
      return;
    }
    setIncome(major(recorded.income, locale));
    setExpenses(recorded.expenses.length ? recorded.expenses.map(row => ({ id: `recorded-${row.id}`, categoryId: row.categoryId, label: "", amount: major(row.amount, locale) })) : [{ id: "expense-0", label: "", amount: major(0, locale) }]);
    setNextId(1);
  }

  return <section className="savings-workspace" data-testid="savings-capacity">
    <p className="savings-intro">{t("تقدير شهري من الأرقام التي تدخلها، وليس ضمانًا للادخار. المدخلات مؤقتة ولا تغيّر حساباتك.", "A monthly estimate from the amounts you enter, not a savings guarantee. Inputs are temporary and do not change your accounts.")}</p>
    <p className="savings-session-note">{t("تُعاد تهيئة المدخلات عند إعادة تحميل الصفحة أو تغيير العملة أو تحديث بياناتك المالية.", "Inputs reset when you reload, switch currencies or refresh financial data.")}</p>
    <section className="panel savings-recorded" aria-labelledby="savings-recorded-title">
      <div><h2 id="savings-recorded-title">{t("ابدأ من سجلك، إن أردت", "Start from your records, if you wish")}</h2><p>{t("يستبدل الدخل وبنود المصروفات بالعمليات المسجلة لهذه العملة. يبقى الاحتياطي الذي اخترته كما هو.", "Replaces income and expense rows with recorded entries in this currency. Your chosen reserve stays unchanged.")}</p></div>
      <div className="savings-recorded-controls"><label className="form-field"><span>{t("الشهر المسجل", "Recorded month")}</span><input data-testid="savings-month" type="month" value={month} min="1900-01" max="2199-12" onChange={event => setMonth(event.target.value)} aria-invalid={!monthValid} /></label><button className="btn btn-secondary" type="button" data-testid="savings-use-recorded-month" onClick={useRecordedMonth} disabled={!monthValid}><ArrowDownToLine size={17} />{t("استخدام الشهر المسجل", "Use recorded month")}</button></div>
    </section>
    {source && <div className="savings-source-note" data-testid="savings-recorded-status" role="status">
      <p>{source.transactionCount ? t("بداية من {month}: {incomeCount} عملية دخل و{expenseCount} عملية مصروف، بإجمالي {total} عملية مسجلة.", "Started from {month}: {incomeCount} income entries and {expenseCount} expense entries, {total} recorded entries in total.", { month: formatMonth(source.month), incomeCount: count(source.incomeCount), expenseCount: count(source.expenseCount), total: count(source.transactionCount) }) : t("لا توجد عمليات مسجلة في {month} بعملة {currency}. أُفرغت المدخلات؛ أدخل تقديراتك بنفسك.", "No entries are recorded for {month} in {currency}. The inputs were cleared; enter your own estimates.", { month: formatMonth(source.month), currency })}</p>
      {source.edited && <p>{t("عدّلت هذه المدخلات بعد تحميلها؛ الحساب الحالي يستخدم القيم المعروضة.", "You edited these inputs after loading them; the calculation uses the values shown.")}</p>}
      {source.transactionCount > 0 && <p>{t("راجع الأرقام وأضف التكاليف غير المسجلة. عدم وجود عملية مسجلة لا يعني عدم وجود دخل أو مصروف.", "Review these amounts and add unrecorded costs. A missing entry does not mean there is no income or expense.")}</p>}
      {source.month === currentMonth && <p className="savings-source-warning" data-testid="savings-partial-month"><AlertCircle size={17} />{t("هذا الشهر لم يكتمل بعد. السجل الحالي قد يكون جزئيًا، وقد يتضمن عمليات مؤرخة لاحقًا.", "This month is still in progress. The current record may be incomplete and may contain future-dated entries.")}</p>}
      {source.month > currentMonth && <p className="savings-source-warning" data-testid="savings-future-month"><AlertCircle size={17} />{t("هذا الشهر لم يبدأ بعد؛ راجع العمليات المسجلة لتواريخ مستقبلية قبل الاعتماد على الأرقام.", "This month has not started; review the future-dated recorded entries before relying on these amounts.")}</p>}
    </div>}
    {loadError && <p className="savings-error" role="alert">{t("تعذر استخدام هذا الشهر. راجع الشهر والبيانات المسجلة، أو أدخل مبالغك يدويًا.", "This month could not be loaded. Check the month and recorded data, or enter your amounts manually.")}</p>}
    <div className="savings-layout">
      <section className="panel savings-input-panel" aria-labelledby="savings-input-title">
        <div className="panel-heading"><div><h2 id="savings-input-title">{t("خطتك الشهرية بالأرقام", "Your monthly plan in numbers")}</h2><p>{t("جميع المبالغ بعملة {currency}. لا نجمع العملات المختلفة.", "All amounts are in {currency}. Different currencies are never combined.", { currency })}</p></div><button className="icon-button" type="button" data-testid="savings-reset" aria-label={t("إعادة ضبط الحاسبة", "Reset calculator")} onClick={reset}><RotateCcw size={18} /></button></div>
        <div className="savings-input-body">
          <label className="form-field savings-income-field"><span>{t("الدخل الشهري", "Monthly income")} <small>{currency}</small></span><input data-testid="savings-income" name="monthlyIncome" inputMode="decimal" type="text" value={income} maxLength={14} autoComplete="off" placeholder={major(0, locale)} required onBlur={() => touch("income")} onChange={event => { setIncome(event.target.value); markEdited(); }} aria-invalid={Boolean(errors.income)} aria-describedby={`savings-income-hint${errors.income ? " savings-income-error" : ""}`} /><small className="savings-field-hint" id="savings-income-hint">{t("استخدم صافي دخلك المتاح بعد الضرائب والاستقطاعات.", "Use take-home income available after taxes and other deductions.")}</small>{errors.income && <small className="form-error" id="savings-income-error">{errors.income}</small>}</label>
          <div className="savings-expenses-heading"><h3>{t("بنود المصروفات الشهرية", "Monthly expense items")}</h3><span>{count(expenses.length)}</span></div>
          <p className="savings-field-hint">{t("أدخل مبالغ شهرية، وأضف بنفسك مخصصًا شهريًا للتكاليف السنوية أو غير المنتظمة. اكتب صفرًا صراحةً إذا لم توجد مصروفات.", "Enter monthly amounts. Add a monthly allowance for annual or irregular costs yourself. Enter zero explicitly if there are no expenses.")}</p>
          <div className="savings-expense-list">{expenses.map((row, index) => <div className="savings-expense-row" data-testid="savings-expense-row" key={row.id}>
            <label className="form-field savings-expense-name"><span>{t("البند {number} (اسم اختياري)", "Item {number} (optional name)", { number: count(index + 1) })}</span><input data-testid="savings-expense-label" name={`label-${row.id}`} type="text" maxLength={120} value={row.categoryId ? categoryLabel(data, row.categoryId, locale) : row.label} placeholder={t("مثلًا: السكن", "e.g. Housing")} onChange={event => editExpense(row.id, { label: event.target.value, categoryId: undefined })} /></label>
            <label className="form-field savings-expense-value"><span>{t("المبلغ", "Amount")}</span><input data-testid="savings-expense-amount" name={`amount-${row.id}`} inputMode="decimal" type="text" maxLength={14} value={row.amount} autoComplete="off" required placeholder={major(0, locale)} onBlur={() => touch(row.id)} onChange={event => editExpense(row.id, { amount: event.target.value })} aria-invalid={Boolean(errors[row.id])} aria-describedby={errors[row.id] ? `error-${row.id}` : undefined} />{errors[row.id] && <small className="form-error" id={`error-${row.id}`}>{errors[row.id]}</small>}</label>
            <button className="icon-button savings-remove" type="button" data-testid="savings-remove-expense" disabled={expenses.length === 1} aria-label={t("حذف البند {number}", "Remove item {number}", { number: count(index + 1) })} onClick={() => { setExpenses(previous => previous.filter(item => item.id !== row.id)); markEdited(); }}><Trash2 size={17} /></button>
          </div>)}</div>
          <button className="btn btn-secondary savings-add-row" type="button" data-testid="savings-add-expense" onClick={addExpense}><Plus size={17} />{t("إضافة بند مصروف", "Add expense item")}</button>
          <label className="form-field savings-reserve-field"><span>{t("احتياطي شهري اختياري", "Optional monthly reserve")} <small>{currency}</small></span><input data-testid="savings-reserve" name="monthlyReserve" inputMode="decimal" type="text" maxLength={14} value={reserve} autoComplete="off" placeholder={major(0, locale)} onBlur={() => touch("reserve")} onChange={event => setReserve(event.target.value)} aria-invalid={Boolean(errors.reserve)} aria-describedby={`savings-reserve-hint${errors.reserve ? " savings-reserve-error" : ""}`} /><small id="savings-reserve-hint" className="savings-field-hint">{t("مبلغ تريد إبقاءه جانبًا قبل الادخار. اتركه صفرًا إن لم تحتج إليه.", "An amount to keep aside before saving. Leave it at zero if you do not need it.")}</small>{errors.reserve && <small className="form-error" id="savings-reserve-error">{errors.reserve}</small>}</label>
          {result && <a className="btn btn-primary savings-view-result" href="#savings-result" data-testid="savings-view-result">{t("عرض النتيجة", "View result")}</a>}
        </div>
      </section>
      <div className="savings-output">
        {calculationError && <p className="savings-error" role="alert">{t("تجاوزت الأرقام النطاق المدعوم. راجع المبالغ وأعد المحاولة.", "These totals exceed the supported range. Check the amounts and try again.")}</p>}
        {result ? <section className="panel savings-result" id="savings-result" tabIndex={-1} data-testid="savings-result" aria-labelledby="savings-result-title">
          <div className="savings-result-hero"><span className="savings-estimate-label">{t("بناءً على مدخلاتك", "Based on your inputs")}</span><h2 id="savings-result-title">{t("أقصى ادخار شهري", "Maximum monthly saving")}</h2><strong className="savings-main-amount" data-testid="savings-maximum" data-value={result.maximumSavings}><bdi>{amount(result.maximumSavings)}</bdi></strong><div className="savings-rate"><span>{t("نسبة الادخار من الدخل", "Savings as a share of income")}</span><strong data-testid="savings-rate" data-value={result.savingsRateBasisPoints ?? ""}>{result.savingsRateBasisPoints === null ? t("غير محددة عندما يكون الدخل صفرًا", "Not applicable when income is zero") : new Intl.NumberFormat(localeTag(locale), { style: "percent", maximumFractionDigits: 2 }).format(result.savingsRateBasisPoints / 10_000)}</strong></div></div>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{t("أقصى ادخار شهري {maximum}. وبعد الاحتياطي {afterReserve}.", "Maximum monthly saving is {maximum}. After reserve: {afterReserve}.", { maximum: amount(result.maximumSavings), afterReserve: amount(result.afterReserve) })}</p>
          {result.deficit > 0 && <p className="savings-deficit-note"><AlertCircle size={19} /><span>{t("تتجاوز المصروفات دخلك بمقدار {amount} شهريًا؛ لذلك لا يوجد فائض للادخار.", "Expenses exceed income by {amount} per month, so there is no surplus to save.", { amount: amount(result.deficit) })}</span></p>}
          <div className="savings-summary-table"><table><caption className="sr-only">{t("تفصيل حساب الادخار الشهري", "Monthly savings calculation breakdown")}</caption><tbody>
            <tr><th scope="row">{t("الدخل الشهري", "Monthly income")}</th><td data-testid="savings-income-total" data-value={result.income}><bdi>{amount(result.income)}</bdi></td></tr>
            <tr><th scope="row">{t("مجموع المصروفات", "Total monthly expenses")}</th><td data-testid="savings-expense-total" data-value={result.expenseTotal}><bdi>{amount(result.expenseTotal)}</bdi></td></tr>
            <tr className="savings-net-row"><th scope="row">{t("صافي الدخل بعد المصروفات", "Income minus expenses")}</th><td data-testid="savings-net" data-value={result.net}><bdi>{amount(result.net)}</bdi></td></tr>
            <tr><th scope="row">{t("العجز الشهري", "Monthly shortfall")}</th><td data-testid="savings-deficit" data-value={result.deficit}><bdi>{amount(result.deficit)}</bdi></td></tr>
            <tr><th scope="row">{t("الاحتياطي المختار", "Chosen reserve")}</th><td data-testid="savings-reserve-total" data-value={result.reserve}><bdi>{amount(result.reserve)}</bdi></td></tr>
          </tbody></table></div>
          <div className="savings-after-reserve"><span>{t("ادخار متاح بعد الاحتياطي", "Saving available after reserve")}</span><strong data-testid="savings-after-reserve" data-value={result.afterReserve}><bdi>{amount(result.afterReserve)}</bdi></strong>{result.reserveShortfall > 0 && <p>{t("ينقص الفائض {amount} لتغطية الاحتياطي الذي اخترته.", "The surplus is {amount} short of your chosen reserve.", { amount: amount(result.reserveShortfall) })}</p>}</div>
          <p className="savings-result-footnote">{t("هذا سقف حسابي لهذه المدخلات. راجع المصروفات الناقصة أو المتغيرة قبل تحديد ادخارك الفعلي.", "This is a calculated ceiling for these inputs. Review missing or variable costs before deciding what you will actually save.")}</p>
        </section> : !calculationError && <section className="panel savings-empty"><Calculator size={29} /><h2>{t("ابدأ بالدخل والمصروفات", "Start with income and expenses")}</h2><p>{t("أدخل الدخل ومبلغ كل بند لظهور النتيجة. الحقل الفارغ ليس صفرًا، ويمكنك إدخال صفر صراحةً.", "Enter income and an amount for every item to see the result. An empty field is not zero; you can enter zero explicitly.")}</p></section>}
        <details className="panel savings-method"><summary>{t("كيف تُحسب النتيجة؟", "How is the result calculated?")}</summary><div>
          <p>{t("الصافي = الدخل الشهري − مجموع بنود المصروفات. أقصى ادخار = الأكبر بين الصافي وصفر. العجز = مقدار الصافي السالب، أو صفر.", "Net = monthly income − the sum of expense items. Maximum saving = the greater of net and zero. The shortfall is the size of a negative net, or zero.")}</p>
          <p>{t("الادخار بعد الاحتياطي = الأكبر بين (الصافي − الاحتياطي) وصفر. نسبة الادخار (٪) = أقصى ادخار ÷ الدخل × 100؛ لا تُحسب النسبة إذا كان الدخل صفرًا.", "Saving after reserve = the greater of (net − reserve) and zero. Savings rate (%) = maximum saving ÷ income × 100; the rate is undefined when income is zero.")}</p>
          <p>{t("استخدام السجل يجمع الدخل والمصروفات المسجلة في الشهر حسب التصنيف، مرة واحدة لكل عملية. لا يُضاف إليه رصيد الحساب أو التحويلات أو الميزانيات أو الأهداف أو الاستحقاقات غير المسجلة.", "Using your records groups recorded monthly income and expenses by category, counting each entry once. Account balances, transfers, budgets, goals and unrecorded recurring items are not added.")}</p>
          <p>{t("هذه مبالغ شهرية يحددها المستخدم، دون تحويل تلقائي للتكاليف السنوية. الحاسبة لا تتحقق من توقيت المدفوعات أو سيولة الحسابات.", "These are monthly amounts supplied by you, with no automatic conversion of annual costs. The calculator does not check payment timing or account liquidity.")}</p>
        </div></details>
        <p className="savings-ledger-note">{t("لإثبات مصروف فعلي، أضفه إلى سجل المعاملات.", "To record an actual expense, add it to your transaction ledger.")} <Link href="/app/transactions">{t("فتح المعاملات", "Open transactions")}</Link></p>
      </div>
    </div>
  </section>;
}
