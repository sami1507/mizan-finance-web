import { expect, test, request, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Snapshot } from "../../src/lib/contracts";

const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3100"}`;
test.setTimeout(180_000);

async function snapshot(owner: APIRequestContext): Promise<Snapshot> {
  const response = await owner.get("/api/finance");
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function demo(page: Page) {
  const owner = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  let response = await owner.post("/api/demo", { data: { locale: "en" } });
  if (response.status() === 429) {
    // Respect the demo creation limit shared by the complete browser suite.
    const retry = Number(response.headers()["retry-after"]);
    await page.waitForTimeout((Number.isFinite(retry) && retry > 0 ? Math.min(retry + 1, 61) : 61) * 1000);
    response = await owner.post("/api/demo", { data: { locale: "en" } });
  }
  expect(response.ok(), await response.text()).toBe(true);
  await page.context().addCookies((await owner.storageState()).cookies);
  await page.goto("/app/transactions");
  await page.getByTestId("language-select").first().selectOption("en");
  await expect(page.getByTestId("add-transaction")).toBeVisible();
  return owner;
}

async function remove(owner: APIRequestContext) {
  const response = await owner.delete("/api/finance", { data: { confirmation: "DELETE" } });
  expect(response.ok(), await response.text()).toBe(true);
  await owner.dispose();
}

async function draft(page: Page, note: string) {
  await page.getByTestId("add-transaction").click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="amount"]').fill("12.34");
  await dialog.locator('input[name="note"]').fill(note);
  return dialog;
}

test("failed loads and writes recover, pending submits stay single, and expired sessions retain the draft", async ({ page }) => {
  const owner = await demo(page);
  let release = () => {};
  try {
    const before = await snapshot(owner);
    let failRead = true;
    await page.route("**/api/finance", async route => {
      if (route.request().method() === "GET" && failRead) {
        failRead = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Delivery QA: temporary read failure" }) });
      } else await route.continue();
    });
    await page.reload();
    await expect(page.locator(".feedback.error")).toContainText("temporary read failure");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByTestId("add-transaction")).toBeVisible();
    await page.unroute("**/api/finance");

    const note = `Delivery retry ${randomUUID()}`;
    let dialog = await draft(page, note);
    const cancelledClose = page.waitForEvent("dialog").then(async prompt => {
      expect(prompt.type()).toBe("confirm");
      expect(prompt.message()).toContain("unsaved changes");
      await prompt.dismiss();
    });
    await Promise.all([cancelledClose, page.keyboard.press("Escape")]);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="note"]')).toHaveValue(note);
    const confirmedClose = page.waitForEvent("dialog").then(async prompt => {
      expect(prompt.type()).toBe("confirm");
      await prompt.accept();
    });
    await Promise.all([confirmedClose, dialog.getByRole("button", { name: "Cancel", exact: true }).click()]);
    await expect(dialog).not.toBeVisible();
    expect(await snapshot(owner)).toEqual(before);
    dialog = await draft(page, note);
    const failedWriteGate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/finance", async route => {
      if (route.request().method() === "POST") {
        await failedWriteGate;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Delivery QA: temporary write failure" }) });
      }
      else await route.continue();
    });
    await dialog.getByTestId("modal-submit").click();
    await expect(dialog.locator('input[name="amount"]')).toBeDisabled();
    release();
    await expect(dialog.getByRole("alert")).toContainText("temporary write failure");
    await expect(dialog.locator('input[name="amount"]')).toBeEnabled();
    await expect(dialog.locator('input[name="amount"]')).toHaveValue("12.34");
    await expect(dialog.locator('input[name="note"]')).toHaveValue(note);
    expect(await snapshot(owner)).toEqual(before);
    await page.unroute("**/api/finance");

    let submissions = 0;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/finance", async route => {
      if (route.request().method() === "POST") { submissions++; await gate; }
      await route.continue();
    });
    await dialog.getByTestId("modal-submit").click();
    await expect.poll(() => submissions).toBe(1);
    await expect(dialog.getByTestId("modal-submit")).toBeDisabled();
    await expect(dialog.locator('input[name="amount"]')).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(submissions).toBe(1);
    release();
    await expect(dialog).not.toBeVisible();
    await page.unroute("**/api/finance");
    expect((await snapshot(owner)).transactions.filter(row => row.note === note)).toHaveLength(1);

    const stale = await draft(page, "Unsaved expired-session draft");
    await page.context().addCookies([{ name: "mizan_demo", value: "expired-or-invalid-delivery-demo", url: origin, httpOnly: true, sameSite: "Lax" }]);
    await stale.getByTestId("modal-submit").click();
    await expect(stale.getByTestId("session-recovery")).toBeVisible();
    await expect(stale.getByTestId("session-recovery")).toHaveAttribute("href", "/login");
    await expect(stale.getByTestId("session-recovery")).toHaveAttribute("target", "_blank");
    await expect(stale.locator('input[name="note"]')).toHaveValue("Unsaved expired-session draft");
    expect((await snapshot(owner)).transactions.some(row => row.note === "Unsaved expired-session draft")).toBe(false);
  } finally {
    release();
    await page.unroute("**/api/finance");
    await remove(owner);
  }
});

test("a lost response after a committed expense can be retried without charging twice", async ({ page }) => {
  const owner = await demo(page);
  try {
    const before = await snapshot(owner);
    const note = `Lost response ${randomUUID()}`;
    const dialog = await draft(page, note);
    const keys: string[] = [];
    let committed = false, loseNext = true;
    await page.route("**/api/finance", async route => {
      if (route.request().method() !== "POST") return route.continue();
      keys.push(route.request().headers()["idempotency-key"] || "");
      if (loseNext) {
        loseNext = false;
        const response = await route.fetch();
        committed = response.ok();
        await route.abort("failed");
      } else await route.continue();
    });
    await dialog.getByTestId("modal-submit").click();
    await expect.poll(() => committed).toBe(true);
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByTestId("modal-submit")).toBeEnabled();
    expect((await snapshot(owner)).transactions.filter(row => row.note === note)).toHaveLength(1);
    // An intervening session failure must not discard an uncertain commit's key.
    await page.context().addCookies([{ name: "mizan_demo", value: "expired-after-commit", url: origin, httpOnly: true, sameSite: "Lax" }]);
    await dialog.getByTestId("modal-submit").click();
    await expect(dialog.getByTestId("session-recovery")).toBeVisible();
    await page.context().addCookies((await owner.storageState()).cookies);
    await dialog.getByTestId("modal-submit").click();
    await expect(dialog).not.toBeVisible();
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBe(keys[0]);
    const after = await snapshot(owner);
    expect(after.transactions).toHaveLength(before.transactions.length + 1);
    expect(after.transactions.filter(row => row.note === note)).toHaveLength(1);
    const entry = after.transactions.find(row => row.note === note)!;
    expect(after.accounts.find(account => account.id === entry.accountId)!.balance)
      .toBe(before.accounts.find(account => account.id === entry.accountId)!.balance - 1234);
    const invalidKey = await owner.post("/api/finance", { headers: { "Idempotency-Key": "not-a-uuid" }, data: { action: "note.create", title: "Must not save", body: "Invalid idempotency key" } });
    expect(invalidKey.status()).toBe(400);
    expect((await snapshot(owner)).notes.some(row => row.title === "Must not save")).toBe(false);
    const staleWorkspace = await owner.post("/api/finance", { headers: { "X-Mizan-Workspace": randomUUID() }, data: { action: "note.create", title: "Wrong workspace", body: "A retained draft must not enter another account" } });
    expect(staleWorkspace.status()).toBe(409);
    expect((await snapshot(owner)).notes.some(row => row.title === "Wrong workspace")).toBe(false);
  } finally { await page.unroute("**/api/finance"); await remove(owner); }
});

test("safe CSV exports reimport without duplicates, external apostrophes survive and invalid previews cannot commit", async ({ page }) => {
  const owner = await demo(page);
  try {
    const start = await snapshot(owner);
    const account = start.accounts.find(row => row.currency === "ILS")!;
    const category = start.categories.find(row => row.kind === "expense")!;
    const today = new Date().toISOString().slice(0, 10);
    const notes = ["=2+2", "+2+2", "-2+2", "@SUM(1,2)", "'=2+2", '=SUM(1,2) · ميزان · שלום · Müller\n"Personal note"'];
    for (const note of notes) {
      const response = await owner.post("/api/finance", { data: { action: "transaction.create", accountId: account.id, categoryId: category.id, kind: "expense", amount: 123, currency: "ILS", date: today, note } });
      expect(response.ok(), await response.text()).toBe(true);
    }
    const before = await snapshot(owner);
    const exported = await owner.get("/api/export?format=csv");
    expect(exported.ok()).toBe(true);
    const csv = await exported.text();
    expect(csv).toContain("noteEncoding");
    expect(csv).toContain("spreadsheet-safe-v1");
    await page.reload();
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    let panel = page.locator(".import-panel");
    await panel.locator('input[type="file"]').setInputFiles({ name: "mizan-round-trip.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(panel.getByRole("button", { name: "Confirm import of 0 transactions", exact: true })).toBeEnabled();
    await panel.getByRole("button", { name: "Confirm import of 0 transactions", exact: true }).click();
    await expect(panel).not.toBeVisible();
    expect((await snapshot(owner)).transactions).toEqual(before.transactions);

    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    panel = page.locator(".import-panel");
    const header = "date,kind,amount,currency,accountId,categoryId,note\n";
    const valid = `${today},expense,1.23,ILS,${account.id},${category.id},'=2+3\n`;
    const invalid = `${today},expense,-1.23,ILS,${account.id},${category.id},Invalid row\n`;
    await panel.locator('input[type="file"]').setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from(header + valid + invalid) });
    await expect(panel.getByRole("button", { name: /^Confirm import of / })).toBeDisabled();
    expect((await snapshot(owner)).transactions).toEqual(before.transactions);
    await panel.locator('input[type="file"]').setInputFiles({ name: "external.csv", mimeType: "text/csv", buffer: Buffer.from(header + valid) });
    await panel.getByRole("button", { name: "Confirm import of 1 transactions", exact: true }).click();
    await expect(panel).not.toBeVisible();
    const after = await snapshot(owner);
    expect(after.transactions).toHaveLength(before.transactions.length + 1);
    expect(after.transactions.some(row => row.note === "'=2+3")).toBe(true);
    for (const note of notes) expect(after.transactions.filter(row => row.note === note)).toHaveLength(1);
  } finally { await remove(owner); }
});
