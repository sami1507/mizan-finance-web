import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.CAPTURE_URL || "http://localhost:3000";
await mkdir("docs/screenshots", { recursive: true });
await mkdir("public", { recursive: true });
const browser = await chromium.launch();
const errors = [];
try {
  for (const locale of ["ar", "en"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
    await context.addInitScript(value => localStorage.setItem("mizan-locale", value), locale);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${baseURL}/demo`);
    await page.getByTestId("add-transaction").waitFor({ timeout: 90_000 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `docs/screenshots/dashboard-${locale === "ar" ? "desktop" : "english"}.png`, fullPage: true });
    for (const mobile of [false, true]) {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 });
      const prefix = `public/dashboard-preview-${mobile ? "mobile-" : ""}${locale}`;
      await page.screenshot({ path: `${prefix}.png` });
      if (mobile) await page.screenshot({ path: `docs/screenshots/dashboard-${locale === "ar" ? "mobile" : "english-mobile"}.png`, fullPage: true });
      await page.getByTestId("theme-toggle").click();
      await page.screenshot({ path: `${prefix}-dark.png` });
      if (!mobile && locale === "ar") await page.screenshot({ path: "docs/screenshots/dashboard-dark.png", fullPage: true });
      await page.getByTestId("theme-toggle").click();
    }
    // Capture landing after its localized dashboard preview files have been updated.
    await page.goto(baseURL, { waitUntil: "networkidle" });
    const suffix = locale === "en" ? "-english" : "";
    await page.screenshot({ path: `docs/screenshots/landing${suffix}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.reload({ waitUntil: "networkidle" });
    await page.screenshot({ path: `docs/screenshots/landing${suffix}-desktop.png`, fullPage: true });
    await page.screenshot({ path: `docs/screenshots/landing${suffix}-viewport.png` });
    await context.close();
  }
} finally { await browser.close(); }
if (errors.length) throw new Error(errors.join("\n"));
console.log("Captured Arabic and English demo screenshots on desktop and mobile; no browser page errors.");
