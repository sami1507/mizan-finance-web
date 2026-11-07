import { z } from "zod";

export const currencySchema = z.enum(["ILS", "USD", "EUR"]);
export const localeSchema = z.enum(["ar", "en", "he", "de"]);
export const idSchema = z.string().min(1).max(200);
export const amountSchema = z.number().int().positive().max(1_000_000_000_000);
export const balanceSchema = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "2199-12-31";
}, "Use a valid date between 1900 and 2199.");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const timezoneSchema = z.string().max(100).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid time zone.");
export const accountSchema = z.object({ name: z.string().trim().min(1).max(80), type: z.enum(["bank", "cash", "wallet"]), currency: currencySchema, openingBalance: balanceSchema });
export const transactionSchema = z.object({ accountId: idSchema, categoryId: idSchema, kind: z.enum(["income", "expense"]), amount: amountSchema, currency: currencySchema, date: dateSchema, note: z.string().trim().max(500).default("") });
export const transferSchema = z.object({ fromAccountId: idSchema, toAccountId: idSchema, amount: amountSchema, date: dateSchema, note: z.string().trim().max(500).default("") });
export const budgetSchema = z.object({ categoryId: idSchema, month: monthSchema, amount: amountSchema, currency: currencySchema });
export const goalSchema = z.object({ name: z.string().trim().min(1).max(100), target: amountSchema, currency: currencySchema, deadline: dateSchema });
export const contributionSchema = z.object({ goalId: idSchema, accountId: idSchema, amount: amountSchema, date: dateSchema });
export const recurringSchema = transactionSchema.omit({ date: true, note: true }).extend({ name: z.string().trim().min(1).max(100), frequency: z.enum(["monthly", "weekly", "yearly"]), nextDate: dateSchema, active: z.boolean().default(true) });
export const profileSchema = z.object({ name: z.string().trim().min(1).max(100), locale: localeSchema, currency: currencySchema, timezone: timezoneSchema });
export const onboardingSchema = profileSchema.extend({ accountName: z.string().trim().min(1).max(80), accountType: z.enum(["bank", "cash", "wallet"]), openingBalance: balanceSchema });
export const noteSchema = z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(5000) });
export class ServiceError extends Error { constructor(message: string, public status = 400) { super(message); } }
