import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.CAPTURE_URL || "http://localhost:3000";
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
const errors = [];
const samples = {
  ar: ["السكن", "المعيشة والمواصلات"],
  en: ["Housing", "Living costs and transport"],
  he: ["דיור", "מחיה ותחבורה"],
  de: ["Wohnen", "Lebenshaltung und Mobilität"],
};
try {
  for (const locale of ["ar", "en", "he", "de"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, reducedMotion: "reduce" });
    await context.addInitScript(value => {
      localStorage.setItem("mizan-locale", value);
      localStorage.setItem("mizan-theme", "light");
    }, locale);
    const page = await context.newPage();
    // First use may initialize the isolated local database and load bundled fonts.
    page.setDefaultTimeout(60_000);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${baseURL}/demo`);
    await page.getByTestId("nav-savings").click();
    await page.getByTestId("savings-income").fill(locale === "de" ? "8000,00" : "8000");
    await page.getByTestId("savings-expense-label").first().fill(samples[locale][0]);
    await page.getByTestId("savings-expense-amount").first().fill("3000");
    await page.getByTestId("savings-add-expense").click();
    await page.getByTestId("savings-expense-label").nth(1).fill(samples[locale][1]);
    await page.getByTestId("savings-expense-amount").nth(1).fill("2000");
    await page.getByTestId("savings-reserve").fill("500");
    await page.getByTestId("savings-result").waitFor();
    if (await page.getByTestId("savings-maximum").getAttribute("data-value") !== "300000") throw new Error("Unexpected savings result");
    if (await page.getByTestId("savings-after-reserve").getAttribute("data-value") !== "250000") throw new Error("Unexpected reserve result");
    async function capture(path) {
      await page.waitForFunction(() => document.documentElement.lang === localStorage.getItem("mizan-locale") && document.documentElement.dataset.theme === localStorage.getItem("mizan-theme"));
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); return document.fonts.ready; });
      await page.mouse.move(0, 0);
      await page.screenshot({ path, fullPage: page.viewportSize().width > 600, animations: "disabled" });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(`docs/screenshots/savings-${locale}-desktop.png`);
    if (locale === "en") {
      await page.getByTestId("theme-toggle").click();
      await capture("docs/screenshots/savings-en-dark.png");
      await page.getByTestId("theme-toggle").click();
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.getByTestId("savings-result").evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 18, behavior: "instant" }));
    await capture(`docs/screenshots/savings-${locale}-mobile.png`);
    await context.close();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Captured real savings calculator views in all four languages; verified 3000 maximum / 2500 after reserve; no page errors.");
} finally { await browser.close(); }
