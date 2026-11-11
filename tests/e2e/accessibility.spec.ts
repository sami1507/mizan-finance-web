import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.setTimeout(180_000);

test("public pages meet automated WCAG checks in Arabic desktop light and English phone dark", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const variants = [
    { locale: "ar", direction: "rtl", theme: "light", width: 1440, height: 1000, toggle: "تغيير المظهر" },
    { locale: "en", direction: "ltr", theme: "dark", width: 390, height: 844, toggle: "Toggle theme" },
  ] as const;

  for (const variant of variants) {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.goto("/");
    await page.getByTestId("language-select").first().selectOption(variant.locale);
    await expect(page.locator("html")).toHaveAttribute("lang", variant.locale);
    if (await page.locator("html").getAttribute("data-theme") !== variant.theme) {
      await page.getByRole("button", { name: variant.toggle, exact: true }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

    for (const route of ["/", "/login", "/register", "/forgot-password"]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", variant.locale);
      await expect(page.locator("html")).toHaveAttribute("dir", variant.direction);
      await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);
      await expect(page.getByTestId("language-select").first()).toHaveValue(variant.locale);
      await expect(page.getByRole("main")).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(result.violations, `${variant.locale}/${variant.theme}/${variant.width}px ${route}`).toEqual([]);
    }
  }
});

test("German dark phone tables are named, reachable by keyboard and horizontally scrollable", async ({ page }) => {
  const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3100"}`;
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let created = false;
  try {
    let response = await page.request.post("/api/demo", { headers: { Origin: origin }, data: { locale: "de" } });
    if (response.status() === 429) {
      const retry = Number(response.headers()["retry-after"]);
      await page.waitForTimeout((Number.isFinite(retry) && retry > 0 ? Math.min(retry + 1, 61) : 61) * 1000);
      response = await page.request.post("/api/demo", { headers: { Origin: origin }, data: { locale: "de" } });
    }
    expect(response.ok(), await response.text()).toBe(true);
    created = true;
    await page.goto("/app/dashboard");
    await page.getByTestId("language-select").first().selectOption("de");
    await expect(page.getByTestId("add-transaction")).toBeVisible();
    if (await page.locator("html").getAttribute("data-theme") !== "dark") await page.getByTestId("theme-toggle").click();

    for (const [section, tableName] of [
      ["dashboard", "Letzte Transaktionen"],
      ["accounts", "Umbuchungsverlauf"],
      ["goals", "Deine letzten Zuordnungen"],
      ["reports", "Kategorienvergleich"],
    ]) {
      await page.goto(`/app/${section}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.getByTestId("add-transaction")).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; });
      const region = page.getByRole("region", { name: tableName, exact: true });
      await expect(region).toBeVisible();
      await expect(region).toHaveAttribute("tabindex", "0");
      await expect(region).toHaveAccessibleName(tableName);
      expect(await region.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
      await region.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(region).toBeFocused();
      const initialScroll = await region.evaluate(element => element.scrollLeft);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialScroll);
      expect(await region.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");

      // The optional chart table must be reachable too once its disclosure is opened.
      for (const summary of await page.locator("details.chart-table > summary").all()) await summary.click();
      for (const table of await page.locator(".table-scroll:visible").all()) {
        await expect(table).toHaveAttribute("tabindex", "0");
        await expect(table).toHaveAccessibleName(/\S/);
      }
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(result.violations, `de/dark/320px /app/${section}`).toEqual([]);
    }
  } finally {
    if (created) {
      const response = await page.request.delete("/api/finance", { headers: { Origin: origin }, data: { confirmation: "DELETE" } });
      expect(response.ok(), await response.text()).toBe(true);
    }
  }
});
