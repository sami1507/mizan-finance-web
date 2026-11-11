"use client";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Currency, Locale } from "@/lib/contracts";
import { createTranslator, isRtl, localeTag } from "@/lib/i18n";
import { money } from "./utils";

export function CashflowChart({ rows, currency, locale }: { rows: { key: string; income: number; expense: number }[]; currency: Currency; locale: Locale }) {
  const t = createTranslator(locale);
  const data = rows.map((r) => ({ ...r, label: new Intl.DateTimeFormat(localeTag(locale), { month: "short", timeZone: "UTC" }).format(new Date(`${r.key}-01T12:00:00Z`)) }));
  return <div className="chart-with-table">
    <div className="cashflow-chart" dir="ltr" role="img" aria-label={t("الرسم البياني للدخل والمصروفات؛ البيانات متاحة في الجدول أدناه", "Income and expenses chart; data available in table below")}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 2, bottom: 0 }}>
          <defs><linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity={0.15} /><stop offset="100%" stopColor="var(--green)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={55} tickFormatter={(v: number) => new Intl.NumberFormat(localeTag(locale), { notation: "compact", maximumFractionDigits: 1 }).format(v)} />
          <Tooltip contentStyle={{ direction: isRtl(locale) ? "rtl" : "ltr", textAlign: "start", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }} labelStyle={{ color: "var(--ink)" }} formatter={(v, name) => [money(Number(v) * 100, currency, locale), name === "income" ? t("الدخل", "Income") : t("المصروفات", "Expenses")]} />
          <Area type="monotone" dataKey="income" stroke="var(--green)" fill="url(#income-fill)" strokeWidth={2.5} isAnimationActive={false} />
          <Area type="monotone" dataKey="expense" stroke="var(--chart-expense)" fill="transparent" strokeWidth={2} strokeDasharray="5 4" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <details className="chart-table"><summary>{t("عرض البيانات كجدول", "View data table")}</summary><div className="table-scroll" tabIndex={0} role="region" aria-label={t("الدخل مقابل الإنفاق", "Income versus spending")}><table><thead><tr><th>{t("الشهر", "Month")}</th><th>{t("الدخل", "Income")}</th><th>{t("المصروفات", "Expenses")}</th></tr></thead><tbody>{data.map((r) => <tr key={r.key}><td>{r.label}</td><td>{money(r.income * 100, currency, locale)}</td><td>{money(r.expense * 100, currency, locale)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

export function SpendingChart({ rows, currency, locale }: { rows: { name: string; amount: number; color: string }[]; currency: Currency; locale: Locale }) {
  const t = createTranslator(locale);
  const total = rows.reduce((n, r) => n + r.amount, 0);
  if (!total) return <div className="chart-empty">{t("ستظهر التفاصيل عند إضافة أول مصروف", "Add your first expense to see a breakdown")}</div>;
  return <div className="spending-block"><div className="donut-wrap" dir="ltr" role="img" aria-label={t("توزيع المصروفات، التفاصيل الرقمية مجاورة للرسم", "Spending distribution; exact values are listed alongside the chart")}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={rows} dataKey="amount" nameKey="name" innerRadius="73%" outerRadius="96%" paddingAngle={3} stroke="none" isAnimationActive={false}>{rows.map((r) => <Cell key={r.name} fill={r.color} />)}</Pie><Tooltip contentStyle={{ direction: isRtl(locale) ? "rtl" : "ltr", textAlign: "start", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => money(Number(v), currency, locale)} /></PieChart></ResponsiveContainer><div className="donut-center"><span>{t("إجمالي الإنفاق", "Total spent")}</span><strong>{money(total, currency, locale)}</strong></div></div><div className="spend-legend" role="table" aria-label={t("جدول المصروفات حسب التصنيف", "Spending by category table")}>{rows.map((r) => <div key={r.name} role="row"><span className="legend-name" role="cell"><i style={{ background: r.color }} />{r.name}</span><strong role="cell">{money(r.amount, currency, locale)}</strong><small role="cell">{new Intl.NumberFormat(localeTag(locale), { style: "percent", maximumFractionDigits: 0 }).format(r.amount / total)}</small></div>)}</div></div>;
}
