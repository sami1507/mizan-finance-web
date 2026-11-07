import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../src/lib/contracts";
import { randomUUID } from "node:crypto";

const futureDate = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10);

test("a new user registers, completes onboarding, records money and signs in again through the UI", async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  const password = `Browser-${randomUUID()}-A1!`;
  await page.goto("/register");
  await page.getByTestId("language-select").first().selectOption("en");
  await page.locator('input[name="name"]').fill("Browser account");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.locator('input[name="name"]').fill("Browser account");
  await page.locator('input[name="accountName"]').fill("Everyday account");
  await page.locator('input[name="openingBalance"]').fill("5000");
  await page.getByTestId("onboarding-submit").click();
  await expect(page.getByTestId("add-transaction")).toBeVisible();

  for (const entry of [{ kind: "income", amount: "2000", note: "Browser salary" }, { kind: "expense", amount: "300", note: "Browser groceries" }]) {
    await page.getByTestId("add-transaction").click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('select[name="kind"]').selectOption(entry.kind);
    await dialog.locator('input[name="amount"]').fill(entry.amount);
    await dialog.locator('input[name="note"]').fill(entry.note);
    await dialog.getByTestId("modal-submit").click();
    await expect(dialog).not.toBeVisible();
  }
  let data = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(data.accounts.find(account => account.name === "Everyday account")!.balance).toBe(670_000);
  await page.reload();
  await expect(page.getByTestId("add-transaction")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("add-transaction")).toBeVisible();
  data = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(data.accounts[0].balance).toBe(670_000);
  expect(data.transactions.some(transaction => transaction.note === "Browser groceries")).toBe(true);

  // A fresh browser preference falls back to the saved account language after login.
  await page.evaluate(() => localStorage.removeItem("mizan-locale"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".finance-app")).toHaveAttribute("dir", "ltr");

  await page.getByTestId("nav-settings").click();
  await page.getByPlaceholder("DELETE", { exact: true }).fill("DELETE");
  await page.getByRole("button", { name: "Permanently delete my account", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get("/api/finance")).status()).toBe(401);
});

test("demo UI creates an expense, budget and goal, persists changes, and exports a report", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.goto("/");
  await page.getByTestId("language-select").first().selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Know where you stand.");
  await page.getByRole("link", { name: "Explore the demo", exact: true }).click();
  await expect(page.getByTestId("add-transaction")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".finance-app")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hello, Sara");
  const demo = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(demo.profile.locale).toBe("en");
  expect(demo.accounts.some(account => account.name === "Main account")).toBe(true);

  await page.getByTestId("add-transaction").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Leave the default expense category intact to cover controlled-select defaults.
  await dialog.locator('[name="amount"]').fill("300.00");
  await dialog.locator('[name="note"]').fill("Browser QA expense");
  await dialog.getByTestId("modal-submit").click();
  await expect(dialog).not.toBeVisible();
  let snapshot = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(snapshot.transactions.find(t => t.note === "Browser QA expense")?.amount).toBe(30_000);

  await page.getByTestId("nav-budgets").click();
  await page.getByTestId("add-budget").click();
  await dialog.locator('[name="amount"]').fill("800");
  await dialog.getByTestId("modal-submit").click();
  await expect(dialog).not.toBeVisible();
  snapshot = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(snapshot.budgets.some(b => b.amount === 80_000)).toBe(true);

  await page.getByTestId("nav-goals").click();
  await page.getByTestId("add-goal").click();
  await dialog.locator('[name="name"]').fill("Browser QA reserve");
  await dialog.locator('[name="target"]').fill("10000");
  await dialog.locator('[name="deadline"]').fill(futureDate);
  await dialog.getByTestId("modal-submit").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Browser QA reserve", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Browser QA reserve", { exact: true })).toBeVisible();
  await expect(page.locator(".finance-app")).toHaveAttribute("dir", "ltr");

  await page.getByTestId("nav-reports").click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printInvoked = "yes"; }; });
  await page.getByTestId("print-report").click();
  await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "yes");
  expect(runtimeErrors).toEqual([]);
});

test("Arabic/English, dark mode, keyboard dialog and mobile/tablet layouts", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.goto("/demo");
  await expect(page.getByTestId("add-transaction")).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath("dashboard-ar-desktop.png"), fullPage: true });

  const initialColor = await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor);
  await page.getByTestId("theme-toggle").click();
  await expect.poll(() => page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(initialColor);
  const darkColor = await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor);
  await page.reload();
  await expect(page.getByTestId("add-transaction")).toBeVisible();
  await expect.poll(() => page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor)).toBe(darkColor);
  await page.getByTestId("add-transaction").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();

  for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("add-transaction")).toBeVisible();
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
    await page.screenshot({ path: testInfo.outputPath(`dashboard-ar-${viewport.width}.png`), fullPage: true });
  }
  await page.getByTestId("language-select").first().selectOption("en");
  await expect(page.locator(".finance-app")).toHaveAttribute("dir", "ltr");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByTestId("add-transaction").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  await page.keyboard.press("Escape");
  expect(runtimeErrors).toEqual([]);
});

test("landing is usable on desktop and mobile and unknown routes show a recovery link", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('a[href="/register"]').first()).toBeVisible();
  await expect(page.locator('a[href="/demo"]').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  await page.screenshot({ path: testInfo.outputPath("landing-mobile.png"), fullPage: true });
  const response = await page.goto("/not-a-real-mizan-page");
  expect(response?.status()).toBe(404);
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
});

test("CSV mapping previews and validates rows before saving and skips repeat imports", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByTestId("add-transaction")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("language-select").first().selectOption("en");
  await page.getByTestId("nav-transactions").click();
  await page.setViewportSize({ width: 390, height: 844 });
  // The accessible Actions heading must stay inside the horizontally scrolling table.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const before = await (await page.request.get("/api/finance")).json() as Snapshot;
  const row = `${new Date().toISOString().slice(0, 10)},27.35,CSV browser verification`;
  const file = { name: "sample.csv", mimeType: "text/csv", buffer: Buffer.from(`date,amount,note\n${row}\n${row}\n`) };
  await page.getByRole("button", { name: /Import CSV/ }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText("1 duplicates will be skipped", { exact: true })).toBeVisible();
  const previewState = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(previewState.transactions.length).toBe(before.transactions.length);
  await page.getByRole("button", { name: "Confirm import of 1 transactions", exact: true }).click();
  await expect(page.locator(".import-panel")).not.toBeVisible();
  const after = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(after.transactions.filter(t => t.note === "CSV browser verification")).toHaveLength(1);
  expect(after.transactions.find(t => t.note === "CSV browser verification")?.amount).toBe(2735);
  await page.getByRole("button", { name: /Import CSV/ }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText("2 duplicates will be skipped", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm import of 0 transactions", exact: true }).click();
  await expect(page.locator(".import-panel")).not.toBeVisible();
  const repeated = await (await page.request.get("/api/finance")).json() as Snapshot;
  expect(repeated.transactions.filter(t => t.note === "CSV browser verification")).toHaveLength(1);
});
