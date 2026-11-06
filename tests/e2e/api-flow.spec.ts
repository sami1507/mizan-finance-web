import { expect, test, request, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Snapshot } from "../../src/lib/contracts";

const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3100"}`;
const today = new Date().toISOString().slice(0, 10);
const futureDate = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10);

async function signUp(ctx: APIRequestContext, email: string, password: string) {
  const response = await ctx.post("/api/auth/sign-up/email", { data: { name: "QA account", email, password } });
  expect(response.ok(), await response.text()).toBe(true);
}

async function snapshot(ctx: APIRequestContext): Promise<Snapshot> {
  const response = await ctx.get("/api/finance");
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function change(ctx: APIRequestContext, action: string, data: Record<string, unknown>) {
  const response = await ctx.post("/api/finance", { data: { action, ...data } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<Snapshot>;
}

test("unauthenticated financial reads, writes and exports are rejected", async () => {
  const anon = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  expect((await anon.get("/api/finance")).status()).toBe(401);
  expect((await anon.get("/api/export?format=json")).status()).toBe(401);
  expect((await anon.post("/api/finance", { data: { action: "account.create", name: "Bad" } })).status()).toBe(401);
  await anon.dispose();
});

test("auth rejects oversized bodies and reports unconfigured password recovery honestly", async () => {
  const ctx = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const oversized = await ctx.post("/api/auth/sign-in/email", { data: { email: "qa@example.test", password: "x".repeat(20_000) } });
  expect(oversized.status()).toBe(413);
  const reset = await ctx.post("/api/auth/request-password-reset", { data: { email: "qa@example.test", redirectTo: `${origin}/reset-password` } });
  expect(reset.status()).toBe(503);
  expect(await reset.text()).toContain("EMAIL_NOT_CONFIGURED");
  await ctx.dispose();
});

test("registration, onboarding, finance, export, login persistence and direct ownership enforcement", async () => {
  const email = `qa-${randomUUID()}@example.test`;
  const password = `QA-${randomUUID()}-A1!`;
  const owner = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const other = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  await signUp(owner, email, password);
  await signUp(other, `qa-${randomUUID()}@example.test`, password);
  const initial = await snapshot(owner);
  expect(initial.profile.onboarded).toBe(false);
  await change(owner, "onboarding", { name: "QA account", locale: "en", currency: "ILS", timezone: "Asia/Jerusalem", accountName: "Everyday", accountType: "bank", openingBalance: 500_000 });
  let s = await snapshot(owner);
  const account = s.accounts[0];
  const expenseCategory = s.categories.find(c => c.kind === "expense")!;
  const incomeCategory = s.categories.find(c => c.kind === "income")!;
  await change(owner, "transaction.create", { accountId: account.id, categoryId: incomeCategory.id, kind: "income", amount: 200_000, currency: "ILS", date: today, note: "QA salary" });
  s = await change(owner, "transaction.create", { accountId: account.id, categoryId: expenseCategory.id, kind: "expense", amount: 30_000, currency: "ILS", date: today, note: "QA groceries" });
  expect(s.accounts[0].balance).toBe(670_000);
  await change(owner, "budget.save", { categoryId: expenseCategory.id, month: today.slice(0, 7), amount: 50_000, currency: "ILS" });
  await change(owner, "goal.create", { name: "QA reserve", target: 1_000_000, currency: "ILS", deadline: futureDate });
  s = await snapshot(owner);
  expect(s.budgets[0].spent).toBe(30_000);
  expect(s.goals[0].saved).toBe(0);
  const exportResponse = await owner.get("/api/export?format=csv");
  expect(exportResponse.ok()).toBe(true);
  expect(exportResponse.headers()["content-type"]).toContain("text/csv");
  expect(await exportResponse.text()).toContain("QA groceries");
  const json = await owner.get("/api/export?format=json");
  expect(json.ok()).toBe(true);
  expect(await json.text()).toContain(account.id);

  const tx = s.transactions[0];
  const forbidden = await other.post("/api/finance", { data: { action: "transaction.update", ...tx, amount: 100 } });
  expect([400, 403, 404]).toContain(forbidden.status());
  const exportOther = await other.get(`/api/export?format=json&userId=${s.profile.id}`);
  expect(exportOther.ok()).toBe(true);
  expect(await exportOther.text()).not.toContain(account.id);
  expect((await other.get(`/api/export?format=csv&accountId=${account.id}`)).status()).toBe(404);
  const emptyPeriod = await owner.get("/api/export?format=csv&from=1900-01-01&to=1900-01-31");
  expect(emptyPeriod.ok()).toBe(true);
  expect(await emptyPeriod.text()).not.toContain("QA groceries");
  const csrf = await owner.post("/api/finance", { headers: { Origin: "https://untrusted.example" }, data: { action: "note.create", title: "Bad origin", body: "blocked" } });
  expect([400, 403]).toContain(csrf.status());
  // A stale demo form must not use an otherwise valid real-user session.
  const realCookies = (await owner.storageState()).cookies.filter(cookie => cookie.name !== "mizan_demo").map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
  const staleDemoHeaders = { Cookie: `${realCookies}; mizan_demo=expired-or-invalid-demo-session` };
  expect((await owner.get("/api/finance", { headers: staleDemoHeaders })).status()).toBe(401);
  expect((await owner.post("/api/finance", { headers: staleDemoHeaders, data: { action: "note.create", title: "Stale demo write", body: "Must never reach real data" } })).status()).toBe(401);
  expect((await snapshot(owner)).notes.some(note => note.title === "Stale demo write")).toBe(false);

  const logout = await owner.post("/api/auth/sign-out", { data: {} });
  expect(logout.ok()).toBe(true);
  expect((await owner.get("/api/finance")).status()).toBe(401);
  const login = await owner.post("/api/auth/sign-in/email", { data: { email, password } });
  expect(login.ok(), await login.text()).toBe(true);
  const persisted = await snapshot(owner);
  expect(persisted.accounts[0].balance).toBe(670_000);
  expect(persisted.goals[0].name).toBe("QA reserve");
  const missingConfirmation = await owner.delete("/api/finance", { data: { confirmation: "wrong" } });
  expect(missingConfirmation.status()).toBe(400);
  expect((await owner.delete("/api/finance", { data: { confirmation: "DELETE" } })).ok()).toBe(true);
  expect((await owner.get("/api/finance")).status()).toBe(401);
  await other.delete("/api/finance", { data: { confirmation: "DELETE" } });
  await Promise.all([owner.dispose(), other.dispose()]);
});

test("each demo visitor has isolated persisted data", async () => {
  const a = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const b = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  expect((await a.post("/api/demo", { data: {} })).ok()).toBe(true);
  expect((await b.post("/api/demo", { data: {} })).ok()).toBe(true);
  const first = await snapshot(a);
  const second = await snapshot(b);
  expect(first.demo).toBe(true);
  expect(first.profile.id).not.toBe(second.profile.id);
  expect(first.accounts[0].id).not.toBe(second.accounts[0].id);
  await change(a, "note.create", { title: "Private demo note", body: "Only visitor A sees this." });
  expect((await snapshot(b)).notes.some(n => n.title === "Private demo note")).toBe(false);
  await change(a, "transaction.create", {
    accountId: first.accounts[0].id,
    categoryId: first.categories.find(c => c.kind === "expense")!.id,
    kind: "expense", amount: 100, currency: first.accounts[0].currency, date: today, note: "=2+2",
  });
  const safeCsv = await a.get("/api/export?format=csv");
  expect(await safeCsv.text()).toContain('"\'=2+2"');
  await a.delete("/api/finance", { data: { confirmation: "DELETE" } });
  await b.delete("/api/finance", { data: { confirmation: "DELETE" } });
  await Promise.all([a.dispose(), b.dispose()]);
});
