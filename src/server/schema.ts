import { pgTable, text, boolean, timestamp, bigint, date, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";

export const user = pgTable("app_user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
  demo: boolean("demo").notNull().default(false),
});
export const session = pgTable("auth_session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at").notNull(), token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("auth_account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"), refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"), password: text("password"), createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
const owner = () => text("user_id").notNull().references(() => user.id, { onDelete: "cascade" });
const money = (name: string) => bigint(name, { mode: "number" }).notNull();
export const profiles = pgTable("profiles", {
  userId: owner().primaryKey(), locale: text("locale").notNull().default("ar"), currency: text("currency").notNull().default("ILS"),
  timezone: text("timezone").notNull().default("Asia/Jerusalem"), onboarded: boolean("onboarded").notNull().default(false),
});
export const financialAccounts = pgTable("financial_accounts", {
  id: text("id").primaryKey(), userId: owner(), name: text("name").notNull(), type: text("type").notNull(), currency: text("currency").notNull(), openingBalance: money("opening_balance"),
}, table => [index("financial_accounts_owner_idx").on(table.userId)]);
export const categories = pgTable("categories", {
  id: text("id").primaryKey(), userId: owner(), name: text("name").notNull(), nameAr: text("name_ar").notNull(), kind: text("kind").notNull(), color: text("color").notNull(),
}, table => [index("categories_owner_idx").on(table.userId)]);
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(), userId: owner(), accountId: text("account_id").notNull().references(() => financialAccounts.id), categoryId: text("category_id").notNull().references(() => categories.id),
  kind: text("kind").notNull(), amount: money("amount"), currency: text("currency").notNull(), date: date("date").notNull(), note: text("note").notNull().default(""), sourceKey: text("source_key"),
}, table => [index("transactions_owner_date_idx").on(table.userId, table.date), uniqueIndex("transactions_owner_source_uq").on(table.userId, table.sourceKey)]);
export const transfers = pgTable("transfers", {
  id: text("id").primaryKey(), userId: owner(), fromAccountId: text("from_account_id").notNull().references(() => financialAccounts.id), toAccountId: text("to_account_id").notNull().references(() => financialAccounts.id),
  amount: money("amount"), date: date("date").notNull(), note: text("note").notNull().default(""),
});
export const budgets = pgTable("budgets", {
  id: text("id").primaryKey(), userId: owner(), categoryId: text("category_id").notNull().references(() => categories.id), month: text("month").notNull(), amount: money("amount"), currency: text("currency").notNull(),
}, table => [uniqueIndex("budget_month_category_uq").on(table.userId, table.categoryId, table.month, table.currency)]);
export const goals = pgTable("goals", {
  id: text("id").primaryKey(), userId: owner(), name: text("name").notNull(), target: money("target"), currency: text("currency").notNull(), deadline: date("deadline").notNull(),
});
export const contributions = pgTable("contributions", {
  id: text("id").primaryKey(), userId: owner(), goalId: text("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }), accountId: text("account_id").notNull().references(() => financialAccounts.id), amount: money("amount"), date: date("date").notNull(),
});
export const recurring = pgTable("recurring", {
  id: text("id").primaryKey(), userId: owner(), name: text("name").notNull(), accountId: text("account_id").notNull().references(() => financialAccounts.id), categoryId: text("category_id").notNull().references(() => categories.id),
  kind: text("kind").notNull(), amount: money("amount"), currency: text("currency").notNull(), frequency: text("frequency").notNull(), nextDate: date("next_date").notNull(), active: boolean("active").notNull().default(true),
});
export const notes = pgTable("notes", {
  id: text("id").primaryKey(), userId: owner(), title: text("title").notNull(), body: text("body").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const demoSessions = pgTable("demo_sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: owner(), expiresAt: timestamp("expires_at").notNull(),
});
export const processedEvents = pgTable("processed_events", {
  id: text("id").primaryKey(), userId: owner(), key: text("key").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [uniqueIndex("processed_events_owner_key_uq").on(table.userId, table.key)]);
export const mutationRequests = pgTable("mutation_requests", {
  userId: owner(), requestId: text("request_id").notNull(), payloadHash: text("payload_hash").notNull(),
  result: jsonb("result").$type<{ imported?: number; skipped?: number; processed?: number }>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [uniqueIndex("mutation_requests_owner_request_uq").on(table.userId, table.requestId)]);
