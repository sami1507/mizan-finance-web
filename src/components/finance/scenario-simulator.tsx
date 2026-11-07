"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, RotateCcw, SlidersHorizontal, Wallet } from "lucide-react";
import type { Currency, Locale, Snapshot } from "@/lib/contracts";
import { addDays, simulatePurchase, SimulationError, type SimulationResult } from "@/lib/simulator";
import { dateLabel, major, minor, money, today } from "./utils";
import { localeTag } from "@/lib/i18n";
import "./scenario.css";

const ScenarioChart = dynamic(() => import("./scenario-chart").then((module) => module.ScenarioChart), { loading: () => <div className="scenario-chart" aria-busy="true" /> });
type Translate = (ar: string, en: string, values?: Record<string, string | number>) => string;
interface Props { data: Snapshot; locale: Locale; currency: Currency; t: Translate; }
type MoneyField = "daily" | "scenarioDaily" | "purchase" | "buffer";

export default function ScenarioSimulator({ data, locale, currency, t }: Props) {
  const [asOf] = useState(() => today(data.profile.timezone));
  const [daily, setDaily] = useState("");
  const [scenarioDaily, setScenarioDaily] = useState<string | null>(null);
  const [purchase, setPurchase] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(asOf);
  const [buffer, setBuffer] = useState("0");
  const [horizon, setHorizon] = useState(30);
  const [protectGoals, setProtectGoals] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [confirmedDuplicates, setConfirmedDuplicates] = useState(false);
  const [touched, setTouched] = useState<string[]>([]);
  const [previousLocale, setPreviousLocale] = useState(locale);
  if (previousLocale !== locale) {
    const reformat = (raw: string) => {
      if (!raw.trim()) return raw;
      try {
        const value = minor(raw, previousLocale);
        return value < 0 ? raw : major(value, locale);
      } catch { return raw; }
    };
    setPreviousLocale(locale);
    setDaily(reformat(daily));
    setScenarioDaily(scenarioDaily === null ? null : reformat(scenarioDaily));
    setPurchase(reformat(purchase));
    setBuffer(reformat(buffer));
  }
  const endDate = addDays(asOf, horizon);
  const accounts = data.accounts.filter((account) => account.currency === currency);
  const accountIds = new Set(accounts.map((account) => account.id));
  const schedules = data.recurring.filter((schedule) => schedule.active && accountIds.has(schedule.accountId));
  const values = { daily, scenarioDaily: scenarioDaily ?? daily, purchase, buffer };
  const parsed: Partial<Record<MoneyField, number>> = {};
  const errors: Partial<Record<MoneyField | "purchaseDate", string>> = {};
  for (const key of Object.keys(values) as MoneyField[]) {
    if (!values[key].trim()) {
      if (touched.includes(key)) errors[key] = t("أدخل مبلغًا؛ يمكنك إدخال صفر صراحةً.", "Enter an amount; you can explicitly enter zero.");
      continue;
    }
    try {
      const value = minor(values[key], locale);
      if (value < 0) throw new Error();
      parsed[key] = value;
    } catch { errors[key] = t("أدخل مبلغًا غير سالب بمنزلتين عشريتين كحد أقصى.", "Enter a non-negative amount with up to two decimal places."); }
  }
  if (!purchaseDate || purchaseDate < asOf || purchaseDate > endDate) errors.purchaseDate = t("اختر تاريخًا داخل فترة المحاكاة.", "Choose a date within the simulation period.");
  const valid = Object.keys(errors).length === 0 && Object.keys(parsed).length === 4;
  const { daily: baselineAmount, scenarioDaily: proposedAmount, purchase: purchaseAmount, buffer: bufferAmount } = parsed;
  const outcome = useMemo(() => {
    if (!valid) return { result: null, error: null };
    try {
      return { result: simulatePurchase(data, { currency, asOf, horizonDays: horizon, dailySpending: baselineAmount!, scenarioDailySpending: proposedAmount!, purchaseAmount: purchaseAmount!, purchaseDate, buffer: bufferAmount!, protectGoals, excludedRecurringIds: excluded }), error: null };
    } catch (error) { return { result: null, error: error instanceof SimulationError ? error.code : "invalid-data" }; }
  }, [data, currency, asOf, horizon, baselineAmount, proposedAmount, purchaseAmount, bufferAmount, purchaseDate, protectGoals, excluded, valid]);
  const duplicates = outcome.result?.possibleDuplicateRecurringIds ?? [];
  const blocked = duplicates.length > 0 && !confirmedDuplicates;
  const result = blocked ? null : outcome.result;
  function touch(field: string) { setTouched((previous) => previous.includes(field) ? previous : [...previous, field]); }
  function reset() {
    setDaily(""); setScenarioDaily(null); setPurchase(""); setPurchaseDate(asOf); setBuffer("0"); setHorizon(30); setProtectGoals(true); setExcluded([]); setConfirmedDuplicates(false); setTouched([]);
  }
  function moneyInput(key: MoneyField, label: string, hint: string, setter: (value: string) => void, testId: string) {
    return <label className="form-field scenario-money-field">
      <span>{label} <small>{currency}</small></span>
      <input data-testid={testId} name={key} type="text" inputMode="decimal" autoComplete="off" maxLength={14} value={values[key]} placeholder={locale === "de" ? "0,00" : "0.00"} required onBlur={() => touch(key)} onChange={(event) => setter(event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={`scenario-${key}-hint${errors[key] ? ` scenario-${key}-error` : ""}`} />
      <small id={`scenario-${key}-hint`} className="scenario-field-hint">{hint}</small>
      {errors[key] && <small id={`scenario-${key}-error`} className="form-error">{errors[key]}</small>}
    </label>;
  }
  if (!accounts.length) return <section className="panel scenario-unavailable"><Wallet size={28} /><h2>{t("لا توجد حسابات بهذه العملة", "No accounts in this currency")}</h2><p>{t("اختر عملة حساب موجود أو أضف حسابًا بعملة {currency} لبدء المحاكاة. لا نحول بين العملات.", "Select a currency with an existing account, or add a {currency} account. Currencies are never combined.", { currency: currency })}</p><Link href="/app/accounts" className="btn btn-secondary">{t("إدارة الحسابات", "Manage accounts")}</Link></section>;
  return <section className="scenario-workspace" data-testid="simulator">
    <div className="scenario-intro"><span className="scenario-status">{t("محاكاة فقط", "Simulation only")}</span><p>{t("اختبر شراءً وتغييرًا في إنفاقك اليومي، قبل اتخاذ القرار. تظل حساباتك كما هي؛ لا تُحفظ هذه المدخلات.", "Explore a purchase and a change in daily spending before you decide. Your accounts stay unchanged; these inputs are not saved.")}</p></div>
    <div className="scenario-layout">
      <section className="panel scenario-assumptions" aria-labelledby="scenario-assumptions-title">
        <div className="panel-heading"><div><h2 id="scenario-assumptions-title"><SlidersHorizontal size={18} />{t("افتراضاتك", "Your assumptions")}</h2><p>{t("أدخل ما تعرفه. لا نفترض إنفاقًا من سجلك.", "Enter what you know. We do not infer spending from your history.")}</p></div><button className="icon-button" type="button" data-testid="simulator-reset" onClick={reset} aria-label={t("إعادة ضبط المحاكاة", "Reset simulation")}><RotateCcw size={18} /></button></div>
        <div className="scenario-inputs">
          <div className="scenario-period"><span>{t("البداية", "Start")}: <strong>{dateLabel(asOf, locale)}</strong></span><label className="form-field"><span>{t("الفترة", "Horizon")}</span><select data-testid="simulator-horizon" value={horizon} onChange={(event) => { setHorizon(Number(event.target.value)); setConfirmedDuplicates(false); }}>{[30, 60, 90].map((days) => <option value={days} key={days}>{t("{days} يومًا", "{days} days", { days: days })}</option>)}</select></label></div>
          <fieldset className="scenario-fieldset"><legend>{t("دون الشراء", "Without purchase")}</legend>{moneyInput("daily", t("الإنفاق اليومي الإضافي", "Additional daily spending"), t("من الغد، فوق العمليات المدرجة أدناه. أدخل صفرًا إن لم يوجد.", "From tomorrow, in addition to the entries below. Enter zero if none."), setDaily, "simulator-daily-spending")}</fieldset>
          <fieldset className="scenario-fieldset"><legend>{t("مع قرارك", "With your decision")}</legend>{moneyInput("purchase", t("مبلغ الشراء مرة واحدة", "One-time purchase amount"), t("يُخصم مرة واحدة في التاريخ الذي تختاره.", "Deducted once, on the date you choose."), setPurchase, "simulator-purchase-amount")}
            <label className="form-field"><span>{t("تاريخ الشراء", "Purchase date")}</span><input data-testid="simulator-purchase-date" type="date" value={purchaseDate} min={asOf} max={endDate} required onChange={(event) => { setPurchaseDate(event.target.value); setConfirmedDuplicates(false); }} aria-invalid={Boolean(errors.purchaseDate)} aria-describedby={errors.purchaseDate ? "scenario-date-error" : undefined} />{errors.purchaseDate && <small id="scenario-date-error" className="form-error">{errors.purchaseDate}</small>}</label>
            {moneyInput("scenarioDaily", t("الإنفاق اليومي بعد القرار", "Daily spending with this decision"), scenarioDaily === null ? t("يتبع الإنفاق الأساسي حتى تعدّله بنفسك.", "Follows your baseline until you edit it." ) : t("يبدأ من الغد في كامل الفترة، حتى لو كان الشراء لاحقًا.", "Starts tomorrow throughout the period, even if the purchase is later."), setScenarioDaily, "simulator-scenario-spending")}
            {scenarioDaily !== null && <button className="text-button scenario-match" type="button" onClick={() => setScenarioDaily(null)}>{t("مطابقة الإنفاق الأساسي", "Match baseline spending")}</button>}
          </fieldset>
          <fieldset className="scenario-fieldset"><legend>{t("حد الأمان الذي تختاره", "Your chosen reserve")}</legend>{moneyInput("buffer", t("احتياطي إضافي", "Additional buffer"), t("رصيد تريد الاحتفاظ به فوق مخصصات الأهداف المحمية.", "Money to retain in addition to protected goal allocations."), setBuffer, "simulator-buffer")}
            <label className="scenario-checkbox"><input data-testid="simulator-protect-goals" type="checkbox" checked={protectGoals} onChange={(event) => setProtectGoals(event.target.checked)} /><span><strong>{t("حماية مخصصات الأهداف الحالية", "Protect current goal allocations")}</strong><small>{t("تُضاف إلى حد الأمان، دون خصمها كمصروف.", "Added to the reserve floor, never deducted as an expense.")}</small></span></label>
          </fieldset>
          <details className="scenario-details scenario-schedules"><summary>{t("العمليات المتكررة المشمولة", "Included recurring schedules")} <span>{schedules.length - excluded.length}/{schedules.length}</span></summary><p>{t("إلغاء التحديد يستبعد كل استحقاقات الجدول من المحاكاتين فقط؛ لا يوقفه في حسابك.", "Unchecking removes every occurrence of a schedule from both simulations only; it does not pause it in your account.")}</p>{schedules.map((schedule) => <label className="scenario-checkbox" key={schedule.id}><input type="checkbox" data-testid={`simulator-schedule-${schedule.id}`} checked={!excluded.includes(schedule.id)} onChange={(event) => { setExcluded((previous) => event.target.checked ? previous.filter((id) => id !== schedule.id) : [...previous, schedule.id]); setConfirmedDuplicates(false); }} /><span><strong>{schedule.name}</strong><small>{schedule.kind === "income" ? t("دخل", "Income") : t("مصروف", "Expense")} · {money(schedule.amount, currency, locale)} · {dateLabel(schedule.nextDate, locale)}</small></span></label>)}{!schedules.length && <p>{t("لا توجد جداول متكررة نشطة بهذه العملة.", "No active recurring schedules in this currency.")}</p>}</details>
        </div>
      </section>
      <div className="scenario-output">
        {outcome.error && <div className="feedback error" role="alert"><AlertCircle size={20} /><span>{outcome.error === "stale-schedule" ? t("يوجد جدول قديم جدًا؛ حدّث موعده أو استبعده من المحاكاة قبل المتابعة.", "A recurring schedule is too old to project safely. Update its date or exclude it before continuing.") : t("تعذر حساب هذا السيناريو. راجع المدخلات والتواريخ، وجرّب مبالغ أصغر إذا تجاوز مجموعها النطاق المدعوم.", "This scenario could not be calculated. Check the inputs and dates, or try smaller amounts if their total exceeds the supported range.")}</span></div>}
        {duplicates.length > 0 && <div className={`scenario-warning ${confirmedDuplicates ? "scenario-overlap-reviewed" : ""}`} role={blocked ? "alert" : undefined} data-testid="simulator-duplicate-warning">
          {confirmedDuplicates ? <Check size={20} /> : <AlertCircle size={20} />}
          <div>
            <h2>{confirmedDuplicates ? t("تمت مراجعة التشابه", "Overlap reviewed") : t("تحقق من عمليات قد تكون مكررة", "Check possibly duplicated payments")}</h2>
            <p>{confirmedDuplicates ? t("تُحتسب العمليات المسجلة والمجدولة معًا بناءً على تأكيدك. يمكنك إلغاء التأكيد في أي وقت.", "Recorded and scheduled entries are both included based on your confirmation. You can undo it at any time.") : t("توجد عمليات مسجلة تطابق موعدًا وحسابًا وتصنيفًا ومبلغًا من هذه الجداول. راجع التفاصيل، ثم استبعد الجدول من الافتراضات أو أكّد أنها عمليات منفصلة قبل عرض النتيجة.", "Recorded entries match the date, account, category and amount of these schedules. Review the details, then uncheck the schedule in the assumptions or confirm these are separate payments before viewing results.")}</p>
            <details className="scenario-details scenario-overlap-details" open={!confirmedDuplicates}>
              <summary>{t("العمليات المسجلة المتشابهة", "Matching recorded entries")}</summary>
              <ul>{schedules.filter((schedule) => duplicates.includes(schedule.id)).map((schedule) => <li key={schedule.id}>
                <strong>{schedule.name}</strong>
                {(outcome.result?.possibleDuplicates ?? []).filter((match) => match.recurringId === schedule.id).map((match) => <div className="scenario-overlap-entry" key={`${match.transactionId}:${match.date}`} data-testid="simulator-duplicate-match">
                  <span><time dateTime={match.date}>{new Intl.DateTimeFormat(localeTag(locale), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${match.date}T12:00:00Z`))}</time><strong>{money(match.amount, currency, locale)}</strong></span>
                  <p>{match.note || t("لا يوجد وصف للعملية المسجلة", "No description on the recorded entry")}</p>
                </div>)}
              </li>)}</ul>
            </details>
            <label className="scenario-checkbox"><input data-testid="simulator-duplicate-confirm" type="checkbox" checked={confirmedDuplicates} onChange={(event) => setConfirmedDuplicates(event.target.checked)} /><span><strong>{t("هذه عمليات منفصلة ويجب احتسابها جميعًا", "These are separate payments and should all be counted")}</strong></span></label>
          </div>
        </div>}
        {!result && !blocked && !outcome.error && <div className="panel scenario-placeholder"><span className="scenario-placeholder-mark"><ArrowRight size={25} /></span><h2>{t("ما أثر هذا القرار على رصيدك؟", "What would this decision change?")}</h2><p>{t("أدخل إنفاقك اليومي ومبلغ الشراء لرؤية المقارنة. صفر قيمة صريحة؛ الحقول الفارغة ليست افتراضًا.", "Enter your daily spending and purchase amount to see the comparison. Zero is an explicit value; an empty field is not an assumption.")}</p><div><span>01</span>{t("حدّد افتراضاتك", "Set your assumptions")}<span>02</span>{t("قارن الرصيد والحد الأدنى", "Compare balances and your reserve")}</div></div>}
        {result && <Results result={result} locale={locale} currency={currency} t={t} daily={parsed.scenarioDaily!} timezone={data.profile.timezone} />}
        <Method t={t} />
      </div>
    </div>
  </section>;
}

function Results({ result, locale, currency, t, daily, timezone }: { result: SimulationResult; locale: Locale; currency: Currency; t: Translate; daily: number; timezone: string }) {
  const amount = (value: number) => money(value, currency, locale);
  const date = (value: string) => dateLabel(value, locale);
  const breach = (value: string | null) => value ? date(value) : t("لا يوجد خلال الفترة", "None during this period");
  const noIncome = !result.events.some((event) => event.kind === "income");
  return <div data-testid="simulator-result">
    <section className="panel scenario-result-panel">
      <div className="panel-heading"><div><h2>{t("نتيجة مشروطة بافتراضاتك", "Conditional on your assumptions")}</h2><p>{date(result.asOf)} — {date(result.endDate)} · {currency} · {timezone}</p></div><span className={`scenario-result-state ${result.scenario.firstBreachDate ? "has-breach" : ""}`}>{result.scenario.firstBreachDate ? <AlertCircle size={17} /> : <Check size={17} />}{result.scenario.firstBreachDate ? t("ينخفض عن الحد", "Below reserve") : t("يبقى ضمن الحد", "Within reserve")}</span></div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{t("الرصيد المقترح في نهاية الفترة {balance}. أول انخفاض عن حد الأمان: {breach}.", "Proposed ending balance {balance}. First reserve breach: {breach}.", { balance: amount(result.scenario.endingBalance), breach: breach(result.scenario.firstBreachDate) })}</p>
      <div className="scenario-opening"><div><span>{t("الرصيد الفعلي عند البداية", "Actual opening balance")}</span><strong>{amount(result.openingBalance)}</strong><small>{t("{count} حساب بهذه العملة، حتى {date}", "{count} account(s) in this currency, as of {date}", { count: result.accountCount, date: date(result.asOf) })}</small></div><div><span>{t("حد الأمان", "Reserve floor")}</span><strong>{amount(result.reserveFloor)}</strong><small>{t("أهداف محمية {goals} + احتياطي {buffer}", "Protected goals {goals} + buffer {buffer}", { goals: amount(result.protectedGoals), buffer: amount(result.reserveFloor - result.protectedGoals) })}</small></div></div>
      <div className="scenario-chart-legend"><span className="baseline">{t("دون الشراء", "Without purchase")}</span><span className="proposed">{t("مع قرارك", "With your decision")}</span><span className="floor">{t("حد الأمان", "Reserve floor")}</span></div>
      <ScenarioChart result={result} locale={locale} />
      <div className="table-scroll scenario-comparison"><table><caption className="sr-only">{t("مقارنة السيناريوهين", "Scenario comparison")}</caption><thead><tr><th scope="col">{t("المقياس", "Measure")}</th><th scope="col">{t("دون الشراء", "Without purchase")}</th><th scope="col">{t("مع قرارك", "With your decision")}</th></tr></thead><tbody><tr><th scope="row">{t("رصيد نهاية الفترة", "Ending balance")}</th><td data-testid="simulator-baseline-ending" data-value={result.baseline.endingBalance}>{amount(result.baseline.endingBalance)}</td><td data-testid="simulator-scenario-ending" data-value={result.scenario.endingBalance}>{amount(result.scenario.endingBalance)}</td></tr><tr><th scope="row">{t("أدنى رصيد وتاريخه", "Lowest balance and date")}</th><td data-testid="simulator-baseline-minimum" data-value={result.baseline.minimumBalance} data-date={result.baseline.minimumDate}>{amount(result.baseline.minimumBalance)}<small>{date(result.baseline.minimumDate)}</small></td><td data-testid="simulator-scenario-minimum" data-value={result.scenario.minimumBalance} data-date={result.scenario.minimumDate}>{amount(result.scenario.minimumBalance)}<small>{date(result.scenario.minimumDate)}</small></td></tr><tr><th scope="row">{t("أول انخفاض عن حد الأمان", "First reserve breach")}</th><td data-testid="simulator-baseline-breach" data-date={result.baseline.firstBreachDate ?? ""}>{breach(result.baseline.firstBreachDate)}</td><td data-testid="simulator-scenario-breach" data-date={result.scenario.firstBreachDate ?? ""}>{breach(result.scenario.firstBreachDate)}</td></tr></tbody></table></div>
      <div className="scenario-result-metrics"><div><span>{t("التغير في رصيد النهاية", "Change in ending balance")}</span><strong data-testid="simulator-ending-delta" data-value={result.delta.endingBalance}>{result.delta.endingBalance > 0 ? "+" : ""}{amount(result.delta.endingBalance)}</strong><small>{t("المقترح − الأساسي؛ القيمة الأعلى تعني مالًا أكثر متبقيًا.", "Proposed − baseline; a higher value means more money remaining.")}</small></div><div><span>{t("السقف المحسوب للشراء في هذا التاريخ", "Calculated purchase ceiling on this date")}</span><strong data-testid="simulator-capacity" data-value={result.purchaseCapacity}>{amount(result.purchaseCapacity)}</strong><small>{t("مع إنفاق يومي مقترح {daily} والحفاظ على حد الأمان بعد الشراء.", "With proposed daily spending of {daily}, preserving the reserve after the purchase.", { daily: amount(daily) })}</small></div></div>
      {result.prePurchaseBreach && <p className="scenario-inline-warning"><AlertCircle size={18} />{t("يوجد انخفاض عن حد الأمان قبل تاريخ الشراء. السقف أعلاه لا يعالج هذا العجز السابق.", "A reserve shortfall occurs before the purchase date. The ceiling above does not resolve that earlier shortfall.")}</p>}
      {result.purchaseCapacity === 0 && result.scenario.firstBreachDate && <p className="scenario-inline-warning"><AlertCircle size={18} />{t("لا يوجد هامش موجب للشراء. الصفر ليس ضمانًا للالتزام بحد الأمان؛ إذا كان العجز قائمًا في الخطة، فإن شراءً بقيمة صفر لا يعالجه. راجع تواريخ الانخفاض.", "There is no positive purchase headroom. Zero does not guarantee the reserve is met; a zero purchase does not repair an existing shortfall in the plan. Review the breach dates.")}</p>}
      <p className="scenario-closing-note">{t("الأرقام أرصدة ختامية يومية مجمعة لهذه العملة، ولا تضمن توفر المال داخل اليوم أو في حساب محدد.", "These are daily closing balances pooled within this currency. They do not guarantee funds during the day or in a particular account.")}</p>
    </section>
    {(result.overdueCount > 0 || noIncome || result.futureContributionCount > 0) && <div className="scenario-model-notes" aria-label={t("ملاحظات الحساب", "Calculation notes")}>
      {result.overdueCount > 0 && <p><AlertCircle size={17} />{t("{count} استحقاق متأخر غير مسجل احتُسب اليوم. راجع تواريخه الأصلية في تفاصيل العمليات.", "{count} unrecorded overdue occurrence(s) are projected today. Review their original dates in the event details.", { count: result.overdueCount })}</p>}
      {noIncome && <p><AlertCircle size={17} />{t("لا توجد مداخيل مدرجة خلال هذه الفترة. لم نضف راتبًا أو دخلًا تقديريًا.", "No income entries are included in this period. No salary or estimated income has been added.")}</p>}
      {result.futureContributionCount > 0 && <p>{t("{count} مساهمة مستقبلية للأهداف غير مشمولة في حد الأمان الحالي.", "{count} future goal contribution(s) are not included in the current reserve floor.", { count: result.futureContributionCount })}</p>}
    </div>}
    <details className="panel scenario-details scenario-audit"><summary>{t("العمليات المشمولة في الحساب", "Entries included in the calculation")} <span>{result.events.length}</span></summary><p>{t("هذه القائمة تعرض العمليات المسجلة مستقبلًا والجداول المتكررة فقط. الإنفاق اليومي والشراء معروضان في الجدول اليومي أدناه.", "This list contains future recorded entries and recurring schedules. Daily spending and the purchase appear in the daily table below.")}</p><div className="table-scroll"><table><thead><tr><th scope="col">{t("تاريخ الاحتساب", "Projected date")}</th><th scope="col">{t("العملية والمصدر", "Entry and source")}</th><th scope="col">{t("النوع", "Type")}</th><th scope="col">{t("المبلغ", "Amount")}</th><th scope="col">{t("تاريخ الاستحقاق الأصلي", "Original due date")}</th></tr></thead><tbody>{result.events.map((event) => <tr key={event.id}><td>{date(event.date)}</td><td>{event.name || t("عملية مسجلة", "Recorded entry")}<small>{event.source === "recorded" ? t("مسجلة بالفعل لتاريخ مستقبلي", "Already recorded for a future date") : t("استحقاق متكرر غير مسجل", "Unrecorded recurring occurrence")}</small></td><td>{event.kind === "income" ? t("دخل", "Income") : t("مصروف", "Expense")}</td><td>{amount(event.amount)}</td><td>{date(event.originalDate)}{event.originalDate < result.asOf && <small>{t("متأخر؛ احتُسب اليوم", "Overdue; projected today")}</small>}</td></tr>)}</tbody></table></div>{!result.events.length && <p>{t("لا توجد عمليات مجدولة أو مسجلة مستقبلًا ضمن الفترة.", "No scheduled or future recorded entries fall within this period.")}</p>}</details>
    <details className="panel scenario-details scenario-audit"><summary>{t("عرض الأرقام اليومية كجدول", "View the full daily table")}</summary><div className="table-scroll"><table><thead><tr>{[t("التاريخ", "Date"), t("الدخل", "Income"), t("المصروفات المدرجة", "Listed expenses"), t("الإنفاق اليومي الأساسي", "Baseline daily spending"), t("الإنفاق اليومي المقترح", "Proposed daily spending"), t("الشراء", "Purchase"), t("الرصيد الأساسي", "Baseline balance"), t("الرصيد المقترح", "Proposed balance"), t("الفرق", "Difference")].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{result.rows.map((row) => <tr key={row.date}><th scope="row">{date(row.date)}</th>{[row.income, row.expense, row.baselineDailySpending, row.scenarioDailySpending, row.purchase, row.baseline, row.scenario, row.delta].map((value, index) => <td key={index}>{amount(value)}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}

function Method({ t }: { t: Translate }) {
  return <details className="panel scenario-details scenario-method"><summary>{t("كيف حُسبت النتيجة؟", "How was this calculated?")}</summary><div>
    <p>{t("الرصيد الافتتاحي = أرصدة الحسابات الافتتاحية + الدخل المسجل حتى اليوم − المصروفات المسجلة حتى اليوم. التحويلات الداخلية تتعادل عند جمع حسابات العملة نفسها.", "Opening balance = account opening balances + income recorded through today − expenses recorded through today. Internal transfers cancel when accounts in the same currency are pooled.")}</p>
    <p>{t("كل يوم: الرصيد السابق + الدخل المدرج − المصروفات المدرجة − الإنفاق اليومي الإضافي. في السيناريو المقترح يُخصم الشراء مرة واحدة. يبدأ الإنفاق اليومي الإضافي من الغد، دون تكرار مصروفات اليوم الفعلية.", "Each day: previous balance + listed income − listed expenses − additional daily spending. The proposed scenario deducts the purchase once. Additional daily spending starts tomorrow, without repeating today’s actual expenses.")}</p>
    <p>{t("حد الأمان = الاحتياطي الذي اخترته + مساهمات الأهداف المسجلة حتى اليوم عند تفعيل الحماية. المخصصات ليست مصروفًا. مساهمات الأهداف المستقبلية ليست جزءًا من النموذج.", "Reserve floor = your chosen buffer + goal contributions recorded through today when protection is enabled. Allocations are not expenses. Future goal contributions are outside this model.")}</p>
    <p>{t("سقف الشراء = أكبر القيمتين: صفر، أو أدنى هامش فوق حد الأمان بدءًا من تاريخ الشراء؛ يُحسب بالإنفاق اليومي المقترح وقبل خصم الشراء. إذا كان الهامش سالبًا نعرض صفرًا، وهذا لا يعني أن الخطة الأساسية خالية من العجز. لا يصلح السقف عجزًا يسبق الشراء.", "Purchase ceiling = max(0, minimum headroom above the reserve from the purchase date onward), using proposed daily spending before deducting the purchase. Negative headroom displays as zero; that does not mean the underlying plan is free of shortfalls. The ceiling cannot repair an earlier shortfall.")}</p>
    <p>{t("تُحتسب العمليات المستقبلية المسجلة مرة واحدة في تاريخها. تُستبعد الاستحقاقات المسجلة بمفتاح التكرار، وتُرحّل الاستحقاقات المتأخرة غير المسجلة إلى اليوم. الجداول التي تستبعدها تبقى في حسابك.", "Future recorded entries are included once on their date. Occurrences already recorded with a recurring source key are excluded; unrecorded overdue occurrences are projected today. Schedules you exclude remain in your account.")}</p>
    <p>{t("هذا إسقاط حسابي مشروط، وليس رصيدًا مستقبليًا مؤكدًا أو توصية. لا تُضاف تحويلات عملة أو تضخم أو دخل أو إنفاق مقدّر من السجل. النتيجة تعتمد على اكتمال بياناتك وافتراضاتك، ولا تغيّر المعاملات أو الأرصدة.", "This is a conditional projection, not a confirmed future balance or a recommendation. No currency conversion, inflation, income, or history-based spending estimates are added. Results depend on complete data and your assumptions; transactions and balances are unchanged.")}</p>
  </div></details>;
}
