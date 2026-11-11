import { expect, test, type Page } from "@playwright/test";
import type { Locale, Snapshot } from "../../src/lib/contracts";

const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3100"}`;
test.setTimeout(180_000);

async function snapshot(page: Page): Promise<Snapshot> {
  const response = await page.request.get("/api/finance");
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function change(page: Page, action: string, fields: Record<string, unknown>): Promise<Snapshot> {
  const response = await page.request.post("/api/finance", { headers: { Origin: origin }, data: { action, ...fields } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function createDemo(page: Page, locale: Locale = "en") {
  let response = await page.request.post("/api/demo", { headers: { Origin: origin }, data: { locale } });
  if (response.status() === 429) {
    // The complete suite shares one IP; respect the application's real demo limit.
    const retry = Number(response.headers()["retry-after"]);
    const seconds = Number.isFinite(retry) && retry > 0 ? Math.min(retry + 1, 61) : 61;
    await page.waitForTimeout(seconds * 1000);
    response = await page.request.post("/api/demo", { headers: { Origin: origin }, data: { locale } });
  }
  expect(response.ok(), await response.text()).toBe(true);
  const data = await snapshot(page);
  expect(data.demo).toBe(true);
  return data;
}

async function removeDemo(page: Page) {
  const response = await page.request.delete("/api/finance", { headers: { Origin: origin }, data: { confirmation: "DELETE" } });
  expect(response.ok(), await response.text()).toBe(true);
}

async function openCalculator(page: Page, locale: Locale = "en") {
  await page.goto("/app");
  await page.getByTestId("language-select").first().selectOption(locale);
  await page.getByTestId("nav-savings").click();
  await expect(page).toHaveURL(/\/app\/savings$/);
  await expect(page.getByTestId("savings-capacity")).toBeVisible();
}

async function output(page: Page, id: string, value: number) {
  await expect(page.getByTestId(`savings-${id}`)).toHaveAttribute("data-value", String(value));
}

async function browserStorage(page: Page) {
  return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
}

test("monthly savings recalculates exact money, rejects invalid amounts and stays temporary", async ({ page }) => {
  await page.goto("/app/savings");
  await expect(page).toHaveURL(/\/login$/);
  const data = await createDemo(page);
  try {
    await openCalculator(page);
    const writes: string[] = [];
    const runtimeErrors: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/finance" && request.method() !== "GET") writes.push(request.method());
    });
    const initialStorage = await browserStorage(page);
    const rows = page.getByTestId("savings-expense-row");
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    await page.getByTestId("savings-income").fill("8000");
    await rows.first().getByTestId("savings-expense-label").fill("Housing · user text");
    await rows.first().getByTestId("savings-expense-amount").fill("3000");
    await page.getByTestId("savings-add-expense").click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    await rows.nth(1).getByTestId("savings-expense-label").fill("Living costs");
    await rows.nth(1).getByTestId("savings-expense-amount").fill("2000");
    await output(page, "maximum", 300_000);
    await output(page, "rate", 3750);
    await page.getByTestId("savings-reserve").fill("500");
    await output(page, "after-reserve", 250_000);

    await rows.nth(1).getByTestId("savings-expense-amount").fill("2500");
    await output(page, "maximum", 250_000);
    await output(page, "after-reserve", 200_000);
    await rows.nth(1).getByTestId("savings-remove-expense").click();
    await expect(rows).toHaveCount(1);
    await output(page, "maximum", 500_000);
    await output(page, "after-reserve", 450_000);

    await rows.first().getByTestId("savings-expense-amount").fill("9000");
    await output(page, "net", -100_000);
    await output(page, "deficit", 100_000);
    await output(page, "maximum", 0);
    await output(page, "after-reserve", 0);
    await output(page, "rate", 0);
    await page.getByTestId("savings-income").fill("0");
    await rows.first().getByTestId("savings-expense-amount").fill("0");
    await output(page, "maximum", 0);
    await expect(page.getByTestId("savings-result")).not.toContainText(/NaN|Infinity/);
    await expect(page.getByTestId("savings-rate")).toHaveAttribute("data-value", "");
    for (const invalid of ["-1", "1.001", "invalid"]) {
      await page.getByTestId("savings-income").fill(invalid);
      await expect(page.getByTestId("savings-income")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByTestId("savings-result")).not.toBeVisible();
    }
    await page.getByTestId("savings-income").fill("8000");
    await page.getByTestId("savings-reserve").fill("9000");
    await output(page, "maximum", 800_000);
    await output(page, "after-reserve", 0);
    expect(await browserStorage(page)).toEqual(initialStorage);
    expect(await snapshot(page)).toEqual(data);

    // Changing display currency must not reinterpret ILS assumptions as USD.
    await page.locator(".currency-picker select").selectOption("USD");
    await expect(page.getByTestId("savings-income")).toHaveValue("");
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    await page.locator(".currency-picker select").selectOption("ILS");
    await expect(page.getByTestId("savings-income")).toHaveValue("");
    await page.getByTestId("savings-income").fill("1234");
    await rows.first().getByTestId("savings-expense-amount").fill("0");
    await page.getByTestId("savings-reset").click();
    await expect(page.getByTestId("savings-income")).toHaveValue("");
    await page.getByTestId("savings-income").fill("6789");
    await rows.first().getByTestId("savings-expense-amount").fill("0");
    await page.reload();
    await expect(page.getByTestId("savings-income")).toHaveValue("");
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    expect(await snapshot(page)).toEqual(data);
    expect(writes).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  } finally { await removeDemo(page); }
});

test("recorded month replaces assumptions, groups categories once and excludes other financial records", async ({ page }) => {
  let data = await createDemo(page);
  try {
    const dateParts = new Intl.DateTimeFormat("en", { timeZone: data.profile.timezone, year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const month = `${dateParts.find(part => part.type === "year")!.value}-${dateParts.find(part => part.type === "month")!.value}`;
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const banks = data.accounts.filter(account => account.currency === "ILS");
    const usd = data.accounts.find(account => account.currency === "USD")!;
    const expense = data.categories.find(category => category.kind === "expense")!;
    const income = data.categories.find(category => category.kind === "income")!;
    for (const entry of [
      { accountId: banks[0].id, categoryId: expense.id, kind: "expense", amount: 1111, currency: "ILS" },
      { accountId: banks[1].id, categoryId: expense.id, kind: "expense", amount: 2222, currency: "ILS" },
      { accountId: banks[0].id, categoryId: income.id, kind: "income", amount: 100_001, currency: "ILS" },
      { accountId: usd.id, categoryId: expense.id, kind: "expense", amount: 88_888, currency: "USD" },
      { accountId: usd.id, categoryId: income.id, kind: "income", amount: 99_999, currency: "USD" },
    ]) await change(page, "transaction.create", { ...entry, date: lastDay, note: "Savings recorded-month fixture" });
    await change(page, "transfer.create", { fromAccountId: banks[0].id, toAccountId: banks[1].id, amount: 10_000, date: lastDay, note: "Not an expense" });
    await change(page, "contribution.create", { goalId: data.goals[0].id, accountId: banks[0].id, amount: 5000, date: lastDay });
    data = await snapshot(page);
    expect(data.recurring.length).toBeGreaterThan(0);
    expect(data.contributions.length).toBeGreaterThan(0);
    expect(data.transfers.length).toBeGreaterThan(0);
    // This oracle reads only raw persisted rows, independently of the calculator helper.
    const recorded = data.transactions.filter(row => row.currency === "ILS" && row.date.slice(0, 7) === month);
    const expectedIncome = recorded.filter(row => row.kind === "income").reduce((sum, row) => sum + row.amount, 0);
    const expenses = new Map<string, number>();
    for (const row of recorded.filter(row => row.kind === "expense")) expenses.set(row.categoryId, (expenses.get(row.categoryId) ?? 0) + row.amount);
    const expectedExpenses = [...expenses.values()].reduce((sum, amount) => sum + amount, 0);
    const expectedMaximum = Math.max(0, expectedIncome - expectedExpenses);
    await openCalculator(page);
    const initialStorage = await browserStorage(page);
    await page.getByTestId("savings-income").fill("1");
    await page.getByTestId("savings-expense-amount").fill("1");
    await page.getByTestId("savings-reserve").fill("500");
    await page.getByTestId("savings-month").fill(month);
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.getByTestId("savings-use-recorded-month").click();
      await expect(page.getByTestId("savings-recorded-status")).toBeVisible();
      await expect(page.getByTestId("savings-income")).toHaveValue((expectedIncome / 100).toFixed(2));
      await expect(page.getByTestId("savings-expense-row")).toHaveCount(expenses.size);
      const amounts = await page.getByTestId("savings-expense-amount").evaluateAll(elements => elements.map(element => Math.round(Number((element as HTMLInputElement).value) * 100)).sort((a, b) => a - b));
      expect(amounts).toEqual([...expenses.values()].sort((a, b) => a - b));
      await output(page, "maximum", expectedMaximum);
      await output(page, "after-reserve", Math.max(0, expectedMaximum - 50_000));
      await expect(page.getByTestId("savings-reserve")).toHaveValue("500");
    }
    const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
    const previous = data.transactions.filter(row => row.currency === "ILS" && row.date.slice(0, 7) === previousMonth);
    const previousNet = previous.reduce((sum, row) => sum + (row.kind === "income" ? row.amount : -row.amount), 0);
    await page.getByTestId("savings-month").fill(previousMonth);
    await page.getByTestId("savings-use-recorded-month").click();
    await output(page, "maximum", Math.max(0, previousNet));
    await page.getByTestId("savings-month").fill("2000-01");
    await page.getByTestId("savings-use-recorded-month").click();
    await expect(page.getByTestId("savings-recorded-status")).toBeVisible();
    await expect(page.getByTestId("savings-income")).toHaveValue("");
    await expect(page.getByTestId("savings-expense-row")).toHaveCount(1);
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    expect(await browserStorage(page)).toEqual(initialStorage);
    expect(await snapshot(page)).toEqual(data);
  } finally { await removeDemo(page); }
});

test("four languages, German decimals, keyboard controls and both themes fit phone, tablet and desktop", async ({ page }) => {
  const data = await createDemo(page, "de");
  try {
    const runtimeErrors: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    await openCalculator(page, "de");
    await page.getByTestId("savings-income").fill("8000,50");
    await page.getByTestId("savings-expense-label").fill("Müller · שלום {name}");
    await page.getByTestId("savings-expense-amount").fill("3000,25");
    await page.getByTestId("savings-reserve").fill("500,10");
    await output(page, "maximum", 500_025);
    await output(page, "after-reserve", 450_015);
    const titles = { ar: "حاسبة الادخار", en: "Savings capacity", he: "יכולת חיסכון", de: "Sparpotenzial" };
    for (const locale of ["en", "he", "ar", "de"] as const) {
      await page.getByTestId("language-select").first().selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" || locale === "he" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(titles[locale]);
      const separator = locale === "de" ? "," : ".";
      await expect(page.getByTestId("savings-income")).toHaveValue(`8000${separator}50`);
      await expect(page.getByTestId("savings-expense-amount")).toHaveValue(`3000${separator}25`);
      await expect(page.getByTestId("savings-reserve")).toHaveValue(`500${separator}10`);
      await expect(page.getByTestId("savings-expense-label")).toHaveValue("Müller · שלום {name}");
      await output(page, "maximum", 500_025);
      await output(page, "after-reserve", 450_015);
      await expect(page.getByTestId("savings-result")).not.toContainText(/\{\w+\}|NaN|Infinity/);
      for (const theme of ["light", "dark"] as const) {
        if (await page.locator("html").getAttribute("data-theme") !== theme) await page.getByTestId("theme-toggle").click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await expect(page.getByTestId("savings-result")).toBeVisible();
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
          for (const id of ["savings-income", "savings-expense-label", "savings-expense-amount", "savings-reserve", "savings-month", "savings-add-expense"]) {
            const control = page.getByTestId(id);
            await expect(control).toHaveAccessibleName(/\S/);
            expect(await control.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
          }
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByTestId("savings-view-result").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("savings-result")).toBeFocused();
    await expect(page.getByTestId("savings-result")).toBeInViewport();
    await page.getByTestId("savings-expense-label").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("savings-expense-amount")).toBeFocused();
    await page.getByTestId("savings-add-expense").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("savings-expense-row")).toHaveCount(2);
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    await page.getByTestId("savings-expense-row").last().getByTestId("savings-remove-expense").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("savings-expense-row")).toHaveCount(1);
    await output(page, "maximum", 500_025);
    await page.getByTestId("savings-income").fill("1.234,56");
    await expect(page.getByTestId("savings-income")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    await page.getByTestId("language-select").first().selectOption("he");
    await expect(page.getByTestId("savings-income")).toHaveValue("1.234,56");
    await expect(page.getByTestId("savings-result")).not.toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    expect(await snapshot(page)).toEqual(data);
    expect(runtimeErrors).toEqual([]);
  } finally { await removeDemo(page); }
});
