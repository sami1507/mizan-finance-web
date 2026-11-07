import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.CAPTURE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
await mkdir("docs/screenshots", { recursive: true });
const errors = [];
try {
  for (const locale of ["en", "ar"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
    await context.addInitScript(({ locale }) => {
      localStorage.setItem("mizan-locale", locale);
      localStorage.setItem("mizan-theme", "light");
    }, { locale });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${baseURL}/demo`);
    await page.getByTestId("nav-simulator").waitFor();
    await page.getByTestId("nav-simulator").click();
    await page.getByTestId("simulator-daily-spending").fill("50");
    await page.getByTestId("simulator-purchase-amount").fill("2400");
    await page.getByTestId("simulator-scenario-spending").fill("35");
    await page.getByTestId("simulator-buffer").fill("1000");
    await page.getByTestId("simulator-result").waitFor();
    await page.locator(".scenario-chart svg.recharts-surface").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `docs/screenshots/simulator-${locale === "en" ? "english" : "arabic"}.png`, animations: "disabled" });
    if (locale === "en") {
      await page.getByTestId("theme-toggle").click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      await page.screenshot({ path: "docs/screenshots/simulator-dark.png", animations: "disabled" });
      await page.getByTestId("theme-toggle").click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.getByTestId("simulator-result").evaluate(element => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 85, behavior: "instant" });
      });
      await page.screenshot({ path: "docs/screenshots/simulator-mobile.png", animations: "disabled" });
    }
    await context.close();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Captured four simulator views from isolated sample workspaces; no page errors.");
} finally {
  await browser.close();
}
