import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.CAPTURE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) throw new Error("Delivery review must use an isolated local preview.");
const output = "docs/screenshots";
await mkdir(output, { recursive: true });
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
const report = { checkedAt: new Date().toISOString(), environment: "Local Chromium, no CPU/network throttling; isolated demo data", samples: [], errors: [] };
try {
  for (const profile of [
    { locale: "ar", theme: "light", width: 1440 }, { locale: "en", theme: "dark", width: 1440 },
    { locale: "he", theme: "light", width: 390 }, { locale: "de", theme: "dark", width: 320 },
    { locale: "ar", theme: "light", width: 768 },
  ]) {
    const context = await browser.newContext({ baseURL, viewport: { width: profile.width, height: 1000 }, reducedMotion: "reduce" });
    await context.addInitScript(({ locale, theme }) => {
      localStorage.setItem("mizan-locale", locale); localStorage.setItem("mizan-theme", theme);
      window.__deliveryLcp = 0;
      new PerformanceObserver(list => { window.__deliveryLcp = list.getEntries().at(-1)?.startTime || 0; }).observe({ type: "largest-contentful-paint", buffered: true });
    }, profile);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.on("pageerror", error => report.errors.push({ profile, error: error.message }));
    page.on("console", message => { if (message.type() === "error") report.errors.push({ profile, error: message.text() }); });
    async function inspect(route, screenshot = false) {
      const started = Date.now();
      const response = await page.goto(route);
      if (response?.status() >= 400) throw new Error(`Unexpected HTTP status at ${route}`);
      if (route.startsWith("/app")) await page.getByTestId("add-transaction").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[aria-busy="true"]').first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
      const readyMs = Date.now() - started;
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, lcpMs: window.__deliveryLcp ? Math.round(window.__deliveryLcp) : null, transferBytes: performance.getEntriesByType("resource").reduce((sum, item) => sum + item.transferSize, 0), fontBytes: performance.getEntriesByType("resource").filter(item => item.name.endsWith(".woff2")).reduce((sum, item) => sum + item.transferSize, 0) }));
      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const violations = scan.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
      report.samples.push({ ...profile, route, readyMs, ...layout, violations, incompleteRules: scan.incomplete.map(item => item.id), manualReview: scan.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })) });
      console.log(JSON.stringify({ ...profile, route, readyMs, overflow: layout.overflow, violations: violations.map(item => item.id) }));
      if (screenshot) await page.screenshot({ path: `${output}/delivery-${route === "/" ? "landing" : route.split("/").at(-1)}-${profile.locale}-${profile.width}-${profile.theme}.png`, fullPage: true });
    }
    await inspect("/", true);
    if (profile.width === 1440) for (const route of ["/login", "/register", "/forgot-password"]) await inspect(route);
    const demo = await context.request.post("/api/demo", { headers: { Origin: baseURL, "x-mizan-locale": profile.locale }, data: { locale: profile.locale }, timeout: 90_000 });
    if (!demo.ok()) throw new Error(`Unable to open isolated demo: ${demo.status()}`);
    const routes = profile.width === 768 ? ["dashboard", "transactions", "savings"] : ["dashboard", "transactions", "accounts", "budgets", "goals", "recurring", "reports", "insights", "settings", "simulator", "savings"];
    for (const route of routes) await inspect(`/app/${route}`, ["dashboard", "savings"].includes(route));
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile("test-results/delivery-review.json", JSON.stringify(report, null, 2));
}
const problems = report.samples.filter(item => item.overflow || item.violations.length);
console.log(JSON.stringify({ samples: report.samples.length, issues: problems.length, runtimeErrors: report.errors.length, report: "test-results/delivery-review.json" }));
if (problems.length || report.errors.length) process.exitCode = 1;
