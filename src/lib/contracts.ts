export type Currency = "ILS" | "USD" | "EUR";
export type Locale = "ar" | "en";
export interface Profile { id: string; name: string; email: string; locale: Locale; currency: Currency; timezone: string; onboarded: boolean; }
export interface Account { id: string; name: string; type: "bank" | "cash" | "wallet"; currency: Currency; openingBalance: number; balance: number; }
export interface Category { id: string; name: string; nameAr: string; kind: "income" | "expense"; color: string; }
export interface Transaction { id: string; accountId: string; categoryId: string; kind: "income" | "expense"; amount: number; currency: Currency; date: string; note: string; sourceKey?: string | null; }
export interface Transfer { id: string; fromAccountId: string; toAccountId: string; amount: number; date: string; note: string; }
export interface Budget { id: string; categoryId: string; month: string; amount: number; currency: Currency; spent: number; }
export interface Goal { id: string; name: string; target: number; currency: Currency; deadline: string; saved: number; }
export interface Contribution { id: string; goalId: string; accountId: string; amount: number; date: string; }
export interface Recurring { id: string; name: string; accountId: string; categoryId: string; kind: "income" | "expense"; amount: number; currency: Currency; frequency: "monthly" | "weekly" | "yearly"; nextDate: string; active: boolean; }
export interface Note { id: string; title: string; body: string; createdAt: string; }
export interface Snapshot { profile: Profile; accounts: Account[]; categories: Category[]; transactions: Transaction[]; transfers: Transfer[]; budgets: Budget[]; goals: Goal[]; contributions: Contribution[]; recurring: Recurring[]; notes: Note[]; demo: boolean; processedRecurringKeys?: string[]; }
// GET /api/finance returns Snapshot; POST accepts { action, ...payload } and returns Snapshot.
// All money in API snapshots and mutations is integer minor units (agorot/cents).
// actions: onboarding, account.create, transaction.create, transaction.update, transaction.delete,
// transfer.create, budget.save, budget.delete, goal.create, goal.delete, contribution.create,
// recurring.create, recurring.update, recurring.process, note.create, note.delete, profile.update,
// import.commit. IDs for updates/deletes are `id`; other payload fields match the relevant interface.
// onboarding: {name, locale, currency, timezone, accountName, accountType, openingBalance}
// sourceKey and processedRecurringKeys are server-assigned read-only provenance, not mutation inputs.
// Processed recurring keys survive deletion of their transaction, preventing forecast duplicates.
// import.commit: {rows: Array<Omit<Transaction,'id'|'sourceKey'>>}; returns Snapshot + imported/skipped counts.
// POST /api/demo creates isolated guest DB/session and seed; returns {ok:true}.
// GET /api/export?format=csv|json; DELETE /api/finance { confirmation: "DELETE" } deletes current user.
