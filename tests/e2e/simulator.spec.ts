import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Snapshot } from "../../src/lib/contracts";
import { addDays } from "../../src/lib/simulator";

const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3100"}`;
const today = new Date().toISOString().slice(0, 10);
test.setTimeout(180_000);

async function change(page: Page, action: string, fields: Record<string, unknown> = {}): Promise<Snapshot> {
  const response = await page.request.post("/api/finance", { headers: { Origin: origin }, data: { action, ...fields } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function snapshot(page: Page): Promise<Snapshot> {
  const response = await page.request.get("/api/finance");
  expect(response.ok()).toBe(true);
  return response.json();
}
async function createWorkspace(page: Page) {
  const options = {
    headers: { Origin: origin }, data: { name: "Scenario test", email: `scenario-${randomUUID()}@example.test`, password: `Test-${randomUUID()}-A1!` },
  };
  let response = await page.request.post("/api/auth/sign-up/email", options);
  // Full production-mode suites share an IP: respect the real 5/min signup cap.
  if (response.status() === 429) {
    const retrySeconds = Number(response.headers()["retry-after"]);
    await new Promise(resolve => setTimeout(resolve, (Number.isFinite(retrySeconds) && retrySeconds > 0 ? Math.min(retrySeconds + 1, 61) : 61) * 1000));
    response = await page.request.post("/api/auth/sign-up/email", options);
  }
  expect(response.ok(), await response.text()).toBe(true);
  return change(page, "onboarding", { name: "Scenario test", locale: "en", currency: "ILS", timezone: "UTC", accountName: "Everyday", accountType: "bank", openingBalance: 500_000 });
}
async function removeWorkspace(page: Page) {
  const response = await page.request.delete("/api/finance", { headers: { Origin: origin }, data: { confirmation: "DELETE" } });
  expect(response.ok()).toBe(true);
}

test("purchase comparison uses real data, changes live, resets and never writes the ledger", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  let data = await createWorkspace(page);
  const accountId = data.accounts[0].id;
  const expenseCategory = data.categories.find(row => row.kind === "expense")!.id;
  const incomeCategory = data.categories.find(row => row.kind === "income")!.id;
  for (const entry of [{ kind: "income", amount: 200_000, date: today }, { kind: "expense", amount: 30_000, date: today }, { kind: "income", amount: 200_000, date: addDays(today, 1) }]) {
    await change(page, "transaction.create", { ...entry, accountId, categoryId: entry.kind === "income" ? incomeCategory : expenseCategory, currency: "ILS", note: "Scenario fixture" });
  }
  await change(page, "recurring.create", { name: "Upcoming rent", accountId, categoryId: expenseCategory, kind: "expense", currency: "ILS", amount: 300_000, frequency: "yearly", nextDate: addDays(today, 2), active: true });
  data = await change(page, "goal.create", { name: "Protected savings", target: 500_000, currency: "ILS", deadline: addDays(today, 90) });
  await change(page, "contribution.create", { goalId: data.goals[0].id, accountId, amount: 100_000, date: today });
  const storedBefore = await snapshot(page);
  await page.goto("/app");
  await page.getByTestId("nav-simulator").click();
  await expect(page).toHaveURL(/\/app\/simulator$/);
  await expect(page.getByRole("heading", { name: "Test a decision", exact: true })).toBeVisible();
  await expect(page.getByTestId("simulator-result")).not.toBeVisible();
  await page.getByTestId("simulator-daily-spending").fill("100");
  await page.getByTestId("simulator-purchase-amount").fill("5000");
  await page.getByTestId("simulator-purchase-date").fill(addDays(today, 2));
  await page.getByTestId("simulator-scenario-spending").fill("80");
  await page.getByTestId("simulator-buffer").fill("500");
  await expect(page.getByTestId("simulator-result")).toBeVisible();
  await expect(page.locator(".scenario-opening")).toContainText("6,700.00");
  await expect(page.locator(".scenario-opening")).toContainText("1,500.00");
  await expect(page.getByTestId("simulator-capacity")).toContainText("1,800.00");
  await expect(page.getByTestId("simulator-ending-delta")).toContainText("4,400.00");
  await expect(page.getByTestId("simulator-baseline-ending")).toHaveAttribute("data-value", "270000");
  await expect(page.getByTestId("simulator-scenario-ending")).toHaveAttribute("data-value", "-170000");
  await expect(page.getByTestId("simulator-ending-delta")).toHaveAttribute("data-value", "-440000");
  await expect(page.getByTestId("simulator-capacity")).toHaveAttribute("data-value", "180000");
  await expect(page.getByTestId("simulator-scenario-breach")).toHaveAttribute("data-date", addDays(today, 2));
  await expect(page.getByTestId("simulator-scenario-minimum")).toHaveAttribute("data-date", addDays(today, 30));
  await expect(page.locator(".scenario-result-state")).toContainText("Below reserve");
  await expect(page.getByRole("row", { name: /Ending balance/ })).toContainText("2,700.00");
  await expect(page.getByRole("row", { name: /Ending balance/ })).toContainText("1,700.00");
  await page.getByText("View the full daily table", { exact: true }).click();
  const dailyTable = page.locator("details").filter({ has: page.getByText("View the full daily table", { exact: true }) });
  await expect(dailyTable.locator("tbody tr")).toHaveCount(31);
  await page.getByText("How was this calculated?", { exact: true }).click();
  await expect(page.locator(".scenario-method")).toContainText("previous balance + listed income − listed expenses − additional daily spending");
  await page.getByTestId("simulator-purchase-amount").fill("1800");
  await expect(page.locator(".scenario-result-state")).toContainText("Within reserve");
  await page.getByTestId("simulator-purchase-amount").fill("1800.01");
  await expect(page.locator(".scenario-result-state")).toContainText("Below reserve");
  await page.getByTestId("simulator-protect-goals").uncheck();
  await expect(page.getByTestId("simulator-capacity")).toContainText("2,800.00");
  await expect(page.locator(".scenario-result-state")).toContainText("Within reserve");
  await page.getByTestId("simulator-purchase-amount").fill("1.001");
  await expect(page.getByTestId("simulator-result")).not.toBeVisible();
  await expect(page.getByTestId("simulator-purchase-amount")).toHaveAttribute("aria-invalid", "true");
  await page.getByTestId("simulator-purchase-amount").fill("0");
  await page.getByTestId("simulator-horizon").selectOption("60");
  await expect(dailyTable.locator("tbody tr")).toHaveCount(61);
  expect(await snapshot(page)).toEqual(storedBefore);
  // A currency switch must never reinterpret an ILS assumption as another currency.
  await page.getByLabel("Display currency").selectOption("EUR");
  await expect(page.getByRole("heading", { name: "No accounts in this currency" })).toBeVisible();
  await page.getByLabel("Display currency").selectOption("ILS");
  await expect(page.getByTestId("simulator-daily-spending")).toHaveValue("");
  await page.getByTestId("simulator-daily-spending").fill("0");
  await page.getByTestId("simulator-purchase-amount").fill("0");
  await page.getByTestId("simulator-reset").click();
  await expect(page.getByTestId("simulator-purchase-amount")).toHaveValue("");
  await page.reload();
  await expect(page.getByTestId("simulator-daily-spending")).toHaveValue("");
  expect(await snapshot(page)).toEqual(storedBefore);
  expect(runtimeErrors).toEqual([]);
  await removeWorkspace(page);
});

test("possible overlaps require an explicit decision and schedule exclusion stays hypothetical", async ({ page }) => {
  const data = await createWorkspace(page);
  const fields = { accountId: data.accounts[0].id, categoryId: data.categories.find(row => row.kind === "expense")!.id, kind: "expense", amount: 10_000, currency: "ILS" };
  await change(page, "transaction.create", { ...fields, date: addDays(today, 1), note: "Manual subscription" });
  const withSchedule = await change(page, "recurring.create", { ...fields, name: "Subscription", frequency: "yearly", nextDate: addDays(today, 1), active: true });
  const id = withSchedule.recurring[0].id;
  await page.goto("/app/simulator");
  await page.getByTestId("simulator-daily-spending").fill("0");
  await page.getByTestId("simulator-purchase-amount").fill("0");
  await expect(page.getByTestId("simulator-duplicate-warning")).toBeVisible();
  await expect(page.getByTestId("simulator-duplicate-warning")).toContainText("Manual subscription");
  await expect(page.getByTestId("simulator-result")).not.toBeVisible();
  await page.getByTestId("simulator-duplicate-confirm").check();
  await expect(page.getByTestId("simulator-result")).toBeVisible();
  await expect(page.getByTestId("simulator-capacity")).toContainText("4,800.00");
  await page.getByTestId("simulator-duplicate-confirm").uncheck();
  await expect(page.getByTestId("simulator-result")).not.toBeVisible();
  await page.getByTestId("simulator-duplicate-confirm").check();
  await page.getByText("Included recurring schedules", { exact: false }).first().click();
  await page.getByTestId(`simulator-schedule-${id}`).uncheck();
  await expect(page.getByTestId("simulator-capacity")).toContainText("4,900.00");
  await page.getByTestId(`simulator-schedule-${id}`).check();
  await expect(page.getByTestId("simulator-duplicate-warning")).toBeVisible();
  expect((await snapshot(page)).recurring[0].active).toBe(true);
  expect((await snapshot(page)).transactions).toHaveLength(1);
  await removeWorkspace(page);
});

test("simulator supports keyboard, Arabic/English, dark mode and responsive chart/table layouts", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await createWorkspace(page);
  await page.goto("/app/simulator");
  await page.getByTestId("simulator-daily-spending").fill("0");
  await page.getByTestId("simulator-purchase-amount").fill("100");
  await expect(page.getByTestId("simulator-result")).toBeVisible();
  for (const locale of ["en", "ar"] as const) {
    if (locale === "ar") await page.getByTestId("language-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    for (const theme of ["light", "dark"] as const) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) await page.getByTestId("theme-toggle").click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByTestId("simulator-result")).toBeVisible();
        const tableSummary = page.getByText(locale === "ar" ? "عرض الأرقام اليومية كجدول" : "View the full daily table", { exact: true });
        if (!(await tableSummary.evaluate(element => element.closest("details")!.open))) await tableSummary.click();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (width <= 600) await expect.poll(() => page.locator(".scenario-comparison").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        const controlHeight = await page.getByTestId("simulator-purchase-amount").evaluate(element => element.getBoundingClientRect().height);
        expect(controlHeight).toBeGreaterThanOrEqual(44);
      }
    }
  }
  await page.getByTestId("simulator-purchase-amount").focus();
  await expect(page.getByTestId("simulator-purchase-amount")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("simulator-purchase-date")).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(runtimeErrors).toEqual([]);
  await removeWorkspace(page);
});
