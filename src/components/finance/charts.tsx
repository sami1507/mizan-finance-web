"use client";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Currency, Locale } from "@/lib/contracts";
import { money } from "./utils";

export function CashflowChart({ rows, currency, locale }: { rows: { key: string; income: number; expense: number }[]; currency: Currency; locale: Locale }) {
  const ar = locale === "ar";
  const data = rows.map((r) => ({ ...r, label: new Intl.DateTimeFormat(ar ? "ar" : "en", { month: "short" }).format(new Date(`${r.key}-01T12:00:00`)) }));
  return <div className="chart-with-table">
    <div className="cashflow-chart" dir="ltr" role="img" aria-label={ar ? "الرسم البياني للدخل والمصروفات؛ البيانات متاحة في الجدول أدناه" : "Income and expenses chart; data available in table below"}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 2, bottom: 0 }}>
          <defs><linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity={0.15} /><stop offset="100%" stopColor="var(--green)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={45} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} />
          <Tooltip contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }} labelStyle={{ color: "var(--ink)" }} formatter={(v, name) => [money(Number(v) * 100, currency, locale), name === "income" ? ar ? "الدخل" : "Income" : ar ? "المصروفات" : "Expenses"]} />
          <Area type="monotone" dataKey="income" stroke="var(--green)" fill="url(#income-fill)" strokeWidth={2.5} isAnimationActive={false} />
          <Area type="monotone" dataKey="expense" stroke="var(--chart-expense)" fill="transparent" strokeWidth={2} strokeDasharray="5 4" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <details className="chart-table"><summary>{ar ? "عرض البيانات كجدول" : "View data table"}</summary><div className="table-scroll"><table><thead><tr><th>{ar ? "الشهر" : "Month"}</th><th>{ar ? "الدخل" : "Income"}</th><th>{ar ? "المصروفات" : "Expenses"}</th></tr></thead><tbody>{data.map((r) => <tr key={r.key}><td>{r.label}</td><td>{money(r.income * 100, currency, locale)}</td><td>{money(r.expense * 100, currency, locale)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

export function SpendingChart({ rows, currency, locale }: { rows: { name: string; amount: number; color: string }[]; currency: Currency; locale: Locale }) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  if (!total) return <div className="chart-empty">{locale === "ar" ? "ستظهر التفاصيل عند إضافة أول مصروف" : "Add your first expense to see a breakdown"}</div>;
  return <div className="spending-block"><div className="donut-wrap" dir="ltr" role="img" aria-label={locale === "ar" ? "توزيع المصروفات، التفاصيل الرقمية مجاورة للرسم" : "Spending distribution; exact values are listed alongside the chart"}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={rows} dataKey="amount" nameKey="name" innerRadius="73%" outerRadius="96%" paddingAngle={3} stroke="none" isAnimationActive={false}>{rows.map((r) => <Cell key={r.name} fill={r.color} />)}</Pie><Tooltip contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => money(Number(v), currency, locale)} /></PieChart></ResponsiveContainer><div className="donut-center"><span>{locale === "ar" ? "إجمالي الإنفاق" : "Total spent"}</span><strong>{money(total, currency, locale)}</strong></div></div><div className="spend-legend" role="table" aria-label={locale === "ar" ? "جدول المصروفات حسب التصنيف" : "Spending by category table"}>{rows.map((r) => <div key={r.name} role="row"><span className="legend-name" role="cell"><i style={{ background: r.color }} />{r.name}</span><strong role="cell">{money(r.amount, currency, locale)}</strong><small role="cell">{Math.round(r.amount / total * 100)}%</small></div>)}</div></div>;
}
