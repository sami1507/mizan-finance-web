"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Locale } from "@/lib/contracts";
import type { SimulationResult } from "@/lib/simulator";
import { createTranslator, isRtl, localeTag } from "@/lib/i18n";
import { dateLabel, money } from "./utils";

export function ScenarioChart({ result, locale }: { result: SimulationResult; locale: Locale }) {
  const t = createTranslator(locale);
  const baseline = t("دون الشراء", "Without purchase");
  const scenario = t("مع القرار", "With your decision");
  return <div className="scenario-chart" dir="ltr" role="img" aria-label={t("الرصيد الختامي اليومي للسيناريوهين؛ الأرقام الكاملة في الجدول أدناه", "Daily closing balances for both scenarios; exact values in the table below")}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={result.rows} margin={{ top: 16, right: 16, bottom: 8, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={44} interval="preserveStartEnd" tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(date: string) => dateLabel(date, locale)} />
        <YAxis width={78} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(value: number) => new Intl.NumberFormat(localeTag(locale), { notation: "compact", maximumFractionDigits: 1 }).format(value / 100)} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ direction: isRtl(locale) ? "rtl" : "ltr", textAlign: "start", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--control-border)", borderRadius: 8, fontSize: 13 }} labelStyle={{ color: "var(--ink)" }} labelFormatter={(date) => dateLabel(String(date), locale)} formatter={(value, name) => [money(Number(value), result.currency, locale), name === "baseline" ? baseline : scenario]} />
        <ReferenceLine y={result.reserveFloor} stroke="var(--chart-expense)" strokeDasharray="2 4" ifOverflow="extendDomain" />
        <Line type="linear" dataKey="baseline" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="scenario" stroke="var(--green)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
