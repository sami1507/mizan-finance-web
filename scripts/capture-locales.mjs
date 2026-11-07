import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Run previews first, restart the production preview to index new public files,
// then run pages. Every capture is an actual, isolated demo workspace.
const phase = process.argv[2] || "previews";
if (!["previews", "pages"].includes(phase)) throw new Error("Use previews or pages.");
const baseURL = process.env.CAPTURE_URL || "http://localhost:3000";
await mkdir("docs/screenshots", { recursive: true });
await mkdir("public", { recursive: true });
const browser = await chromium.launch();
const errors = [];
const names = { ar: "arabic", en: "english", he: "hebrew", de: "german" };
try {
  for (const locale of ["ar", "en", "he", "de"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce" });
    await context.addInitScript(value => { localStorage.setItem("mizan-locale", value); localStorage.setItem("mizan-theme", "light"); }, locale);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    async function capture(path, fullPage = false) {
      await page.waitForFunction(() => document.documentElement.lang === localStorage.getItem("mizan-locale") && document.documentElement.dataset.theme === (localStorage.getItem("mizan-theme") || "light"));
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); return document.fonts.ready; });
      await page.mouse.move(0, 0);
      await page.screenshot({ path, fullPage, animations: "disabled" });
    }
    if (phase === "previews") {
      await page.goto(`${baseURL}/demo`);
      await page.getByTestId("add-transaction").waitFor();
      await page.waitForLoadState("networkidle");
      for (const mobile of [false, true]) {
        await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 });
        const prefix = `public/dashboard-preview-${mobile ? "mobile-" : ""}${locale}`;
        await capture(`${prefix}.png`);
        const dashboardName = locale === "ar" ? (mobile ? "mobile" : "desktop") : `${names[locale]}${mobile ? "-mobile" : ""}`;
        await capture(`docs/screenshots/dashboard-${dashboardName}.png`, true);
        await page.getByTestId("theme-toggle").click();
        await capture(`${prefix}-dark.png`);
        if (!mobile && locale === "ar") await capture("docs/screenshots/dashboard-dark.png", true);
        await page.getByTestId("theme-toggle").click();
      }
    } else {
      await page.goto(baseURL, { waitUntil: "networkidle" });
      const suffix = locale === "ar" ? "" : `-${names[locale]}`;
      await capture(`docs/screenshots/landing${suffix}-desktop.png`, true);
      await capture(`docs/screenshots/landing${suffix}-viewport.png`);
      await page.setViewportSize({ width: 390, height: 844 });
      await capture(`docs/screenshots/landing${suffix}-mobile.png`, true);
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(`${baseURL}/demo`);
      await page.getByTestId("nav-simulator").click();
      await page.getByTestId("simulator-daily-spending").fill(locale === "de" ? "50,00" : "50");
      await page.getByTestId("simulator-purchase-amount").fill("2400");
      await page.getByTestId("simulator-scenario-spending").fill(locale === "de" ? "35,00" : "35");
      await page.getByTestId("simulator-buffer").fill("1000");
      await page.getByTestId("simulator-result").waitFor();
      await page.locator(".scenario-chart svg.recharts-surface").waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(`docs/screenshots/simulator-${names[locale]}.png`);
      if (locale === "he" || locale === "de") {
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.getByTestId("simulator-result").evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 20, behavior: "instant" }));
        await capture(`docs/screenshots/simulator-${names[locale]}-mobile.png`);
      }
    }
    await context.close();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Captured ${phase} in Arabic, English, Hebrew and German; no page errors.`);
} finally { await browser.close(); }
