import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Snapshot } from "../../src/lib/contracts";

const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3100"}`;
test.setTimeout(180_000);

// Fixed expected copy is intentional: a missing translation must not pass by
// reading the same fallback dictionary as the application under test.
const cases = [
  {
    locale: "he", direction: "rtl", decimal: "123.45", opening: "5000.00",
    landing: "לדעת איפה עומדים.", register: "יצירת חשבון במיזאן.",
    login: "טוב שחזרת.", forgot: "שכחת את הסיסמה?", onboarding: "ברוכים הבאים למיזאן",
    invalidLogin: "כתובת הדוא״ל או הסיסמה שגויה.", themeToggle: "החלפת מצב התצוגה",
    amount: "סכום", addTransaction: "הוספת תנועה", editTransaction: "עריכת תנועה",
    preferences: "שמירת העדפות", greeting: "שלום, ",
    conditional: "תוצאה המותנית בהנחות שלך", dynamicAllowance: "בהוצאה יומית מוצעת של",
    headings: { transactions: "תנועות", accounts: "חשבונות", budgets: "תקציבים", goals: "יעדי חיסכון", recurring: "תנועות קבועות", reports: "דוחות", simulator: "בדיקת החלטה", insights: "תובנות כספיות", settings: "הגדרות" },
  },
  {
    locale: "de", direction: "ltr", decimal: "123,45", opening: "5000,00",
    landing: "Wisse, wo du stehst.", register: "Erstelle dein Mizan-Konto.",
    login: "Willkommen zurück.", forgot: "Passwort vergessen?", onboarding: "Willkommen bei Mizan",
    invalidLogin: "E-Mail-Adresse oder Passwort ist falsch.", themeToggle: "Darstellung wechseln",
    amount: "Betrag", addTransaction: "Transaktion hinzufügen", editTransaction: "Transaktion bearbeiten",
    preferences: "Einstellungen speichern", greeting: "Hallo, ",
    conditional: "Abhängig von deinen Annahmen", dynamicAllowance: "Bei vorgeschlagenen täglichen Ausgaben von",
    headings: { transactions: "Transaktionen", accounts: "Konten", budgets: "Budgets", goals: "Sparziele", recurring: "Wiederkehrend", reports: "Berichte", simulator: "Entscheidung prüfen", insights: "Finanzielle Einblicke", settings: "Einstellungen" },
  },
] as const;

async function noPageOverflow(page: Page, width: number) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}

async function registerThroughUI(page: Page) {
  const submit = () => Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/auth/sign-up/email") && response.request().method() === "POST"),
    page.locator("form button.auth-submit").click(),
  ]);
  let [response] = await submit();
  if (response.status() === 429) {
    // Respect the real shared-IP signup limit; never bypass or mock auth.
    const retryAfter = Number(response.headers()["retry-after"]);
    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter + 1, 61) : 61;
    await page.waitForTimeout(seconds * 1000);
    [response] = await submit();
  }
  expect(response.ok(), await response.text()).toBe(true);
}

async function readSnapshot(page: Page): Promise<Snapshot> {
  const response = await page.request.get("/api/finance");
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

for (const copy of cases) {
  test(`${copy.locale}: real signup, localized amounts, profile fallback and the full financial workspace`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const name = "Locale QA · unchanged";
    const accountName = "Manual ILS · untouched";
    const note = "Locale QA purchase — preserve";
    let created = false;
    try {
      await page.goto("/register");
      await page.getByTestId("language-select").first().selectOption(copy.locale);
      await expect(page.locator("html")).toHaveAttribute("lang", copy.locale);
      await expect(page.locator("html")).toHaveAttribute("dir", copy.direction);
      await expect(page.getByRole("heading", { level: 2, name: copy.register, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Create your Mizan account.", exact: true })).toHaveCount(0);
      await page.locator('input[name="name"]').fill(name);
      await page.locator('input[name="email"]').fill(`locale-${copy.locale}-${randomUUID()}@example.test`);
      await page.locator('input[name="password"]').fill(`Locale-${randomUUID()}-A1!`);
      await registerThroughUI(page);
      created = true;
      await expect(page).toHaveURL(/\/onboarding$/);
      await expect(page.getByRole("heading", { level: 2, name: copy.onboarding, exact: true })).toBeVisible();
      await page.locator('input[name="name"]').fill(name);
      await page.locator('input[name="accountName"]').fill(accountName);
      await page.locator('select[name="timezone"]').selectOption("UTC");
      await page.locator('input[name="openingBalance"]').fill(copy.opening);
      await page.getByTestId("onboarding-submit").click();
      await expect(page.getByTestId("add-transaction")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(`${copy.greeting}Locale`);
      let snapshot = await readSnapshot(page);
      expect(snapshot.profile.locale).toBe(copy.locale);
      expect(snapshot.profile.name).toBe(name);
      expect(snapshot.accounts[0].openingBalance).toBe(500_000);
      expect(snapshot.accounts[0].name).toBe(accountName);

      await page.getByTestId("add-transaction").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: copy.addTransaction, exact: true })).toBeVisible();
      await dialog.getByLabel(copy.amount, { exact: true }).fill(copy.decimal);
      await dialog.locator('input[name="note"]').fill(note);
      await dialog.getByTestId("modal-submit").click();
      await expect(dialog).not.toBeVisible();
      snapshot = await readSnapshot(page);
      expect(snapshot.transactions.find(row => row.note === note)?.amount).toBe(12_345);
      expect(snapshot.accounts[0].balance).toBe(487_655);
      await page.getByTestId("nav-transactions").click();
      const transaction = page.locator(".transaction-table tbody tr").filter({ hasText: note });
      await expect(transaction.locator(".amount-cell")).toContainText(copy.decimal);
      await transaction.getByRole("button", { name: copy.editTransaction, exact: true }).click();
      await expect(dialog.getByLabel(copy.amount, { exact: true })).toHaveValue(copy.decimal);
      await page.keyboard.press("Escape");
      await page.reload();
      await expect(transaction.locator(".amount-cell")).toContainText(copy.decimal);
      expect((await readSnapshot(page)).transactions.find(row => row.note === note)?.amount).toBe(12_345);

      await page.getByTestId("nav-settings").click();
      await expect(page.locator('.settings-form input[name="name"]')).toHaveValue(name);
      await page.locator(".settings-form").getByTestId("language-select").selectOption(copy.locale);
      const saved = page.waitForResponse(response => response.url().endsWith("/api/finance") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "profile.update");
      await page.getByRole("button", { name: copy.preferences, exact: true }).click();
      expect((await saved).ok()).toBe(true);
      expect((await readSnapshot(page)).profile.locale).toBe(copy.locale);
      // Remove only the presentation preference; the trusted profile restores it.
      await page.evaluate(() => localStorage.removeItem("mizan-locale"));
      await page.reload();
      await expect(page.getByTestId("language-select").first()).toHaveValue(copy.locale);
      await expect(page.locator("html")).toHaveAttribute("lang", copy.locale);
      await expect(page.locator(".finance-app")).toHaveAttribute("dir", copy.direction);
      await expect(page.locator('.settings-form input[name="name"]')).toHaveValue(name);

      for (const [section, title] of Object.entries(copy.headings)) {
        await page.getByTestId(`nav-${section}`).click();
        await expect(page).toHaveURL(new RegExp(`/app/${section}$`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
        await expect(page.getByTestId("add-transaction")).toHaveText(copy.addTransaction);
      }
      await page.getByTestId("nav-dashboard").click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(`${copy.greeting}Locale`);
      await page.getByTestId("nav-simulator").click();
      await page.getByTestId("simulator-daily-spending").fill("0");
      await page.getByTestId("simulator-purchase-amount").fill("100");
      const result = page.getByTestId("simulator-result");
      await expect(result).toBeVisible();
      await expect(result.getByRole("heading", { name: copy.conditional, exact: true })).toBeVisible();
      await expect(result).toContainText(copy.dynamicAllowance);
      await expect(result).not.toContainText("With proposed daily spending");
      await expect(result).not.toContainText(/\{\w+\}/);
      await expect(page.getByTestId("simulator-scenario-ending")).toHaveAttribute("data-value", "477655");

      if (copy.locale === "de") {
        await page.getByTestId("simulator-daily-spending").fill("1,25");
        await page.getByTestId("simulator-scenario-spending").fill("2,50");
        await page.getByTestId("simulator-purchase-amount").fill("100,25");
        await page.getByTestId("simulator-buffer").fill("50,75");
        await expect(page.getByTestId("simulator-scenario-ending")).toHaveAttribute("data-value", "470130");
        for (const nextLocale of ["en", "he", "de"]) {
          await page.getByTestId("language-select").first().selectOption(nextLocale);
          await expect(page.locator("html")).toHaveAttribute("lang", nextLocale);
          const separator = nextLocale === "de" ? "," : ".";
          await expect(page.getByTestId("simulator-daily-spending")).toHaveValue(`1${separator}25`);
          await expect(page.getByTestId("simulator-scenario-spending")).toHaveValue(`2${separator}50`);
          await expect(page.getByTestId("simulator-purchase-amount")).toHaveValue(`100${separator}25`);
          await expect(page.getByTestId("simulator-buffer")).toHaveValue(`50${separator}75`);
          await expect(page.getByTestId("simulator-scenario-ending")).toHaveAttribute("data-value", "470130");
        }
      }

      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const theme of ["light", "dark"]) {
          if ((await page.locator("html").getAttribute("data-theme")) !== theme) await page.getByTestId("theme-toggle").click();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await noPageOverflow(page, width);
          await expect.poll(() => page.locator(".scenario-comparison").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
          await page.getByTestId("add-transaction").click();
          await expect(dialog).toBeVisible();
          await expect(dialog.getByLabel(copy.amount, { exact: true })).toBeVisible();
          const bounds = await dialog.evaluate(element => ({ width: element.getBoundingClientRect().width, client: element.clientWidth, scroll: element.scrollWidth }));
          expect(bounds.width).toBeLessThanOrEqual(width);
          expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
          await page.keyboard.press("Escape");
          await expect(dialog).not.toBeVisible();
        }
      }
      snapshot = await readSnapshot(page);
      expect(snapshot.profile.name).toBe(name);
      expect(snapshot.accounts[0].name).toBe(accountName);
      expect(snapshot.accounts[0].balance).toBe(487_655);
      expect(snapshot.transactions).toHaveLength(1);
      expect(snapshot.transactions[0].note).toBe(note);
      expect(errors).toEqual([]);
    } finally {
      if (created) {
        const response = await page.request.delete("/api/finance", { headers: { Origin: origin, "x-mizan-locale": copy.locale }, data: { confirmation: "DELETE" } });
        expect(response.ok(), await response.text()).toBe(true);
      }
    }
  });
}

test("Hebrew and German public pages keep their language, direction and localized authentication feedback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const copy of cases) {
    await page.goto("/");
    await page.getByTestId("language-select").first().selectOption(copy.locale);
    await expect(page.locator("html")).toHaveAttribute("lang", copy.locale);
    await expect(page.locator("html")).toHaveAttribute("dir", copy.direction);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(copy.landing);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ["light", "dark"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) await page.getByRole("button", { name: copy.themeToggle, exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await noPageOverflow(page, width);
      }
    }
    for (const [path, title] of [["/register", copy.register], ["/login", copy.login], ["/forgot-password", copy.forgot]]) {
      await page.goto(path);
      await expect(page.getByTestId("language-select").first()).toHaveValue(copy.locale);
      await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^(Welcome back\.|Create your Mizan account\.|Forgot your password\?)$/ })).toHaveCount(0);
      await noPageOverflow(page, 390);
    }
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(`missing-${randomUUID()}@example.test`);
    await page.locator('input[name="password"]').fill("NotARealPassword-123!");
    await page.locator("form button.auth-submit").click();
    await expect(page.locator(".auth-feedback[role='alert']")).toHaveText(copy.invalidLogin);
  }
  expect(errors).toEqual([]);
});
