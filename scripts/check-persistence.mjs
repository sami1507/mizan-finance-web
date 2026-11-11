import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "node:net";

const port = 3331;
const origin = `http://127.0.0.1:${port}`;
const fixtureDirectory = path.resolve(process.env.PERSISTENCE_TEST_ROOT || "data", `persistence-${randomUUID()}`);
const env = { ...process.env, NODE_ENV: "production", DATABASE_URL: "", SMTP_URL: "", MAIL_FROM: "", ALLOW_LOCAL_DB: "true", BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "isolated-persistence-check-not-a-production-secret-20261111", PGLITE_DATA_DIR: fixtureDirectory, NEXT_TELEMETRY_DISABLED: "1" };
let server;
async function start() {
  server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, stdio: "ignore" });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Isolated preview stopped before it became ready. Ensure port 3331 is available.");
    try { if ((await fetch(`${origin}/api/health?check=ready`, { signal: AbortSignal.timeout(6_000) })).ok) return; } catch { /* Startup is bounded below. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Isolated persistence preview did not become ready.");
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const finished = once(server, "exit"); server.kill("SIGTERM");
  await finished; server = undefined;
}
try {
  // Refuse to send demo/mutation requests to an application that already owns this port.
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", resolve); });
  await new Promise(resolve => probe.close(resolve));
  console.log("Preparing the isolated database with the documented migration command (cold Windows storage can take several minutes).");
  const bootstrap = spawn(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], { env, windowsHide: true, stdio: "ignore" });
  const deadline = setTimeout(() => bootstrap.kill("SIGTERM"), 600_000);
  const [exitCode] = await once(bootstrap, "exit"); clearTimeout(deadline);
  assert.equal(exitCode, 0, "Isolated database preparation failed or exceeded ten minutes.");
  console.log("Starting isolated production preview for a real stop/start persistence check.");
  await start();
  const demo = await fetch(`${origin}/api/demo`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ locale: "en" }), signal: AbortSignal.timeout(60_000) });
  assert.equal(demo.status, 200);
  const cookie = demo.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie);
  const headers = { Origin: origin, "Content-Type": "application/json", Cookie: cookie };
  const snapshot = await (await fetch(`${origin}/api/finance`, { headers })).json();
  const account = snapshot.accounts[0], category = snapshot.categories.find(row => row.kind === "income");
  const requestId = randomUUID();
  const body = JSON.stringify({ action: "transaction.create", accountId: account.id, categoryId: category.id, currency: account.currency, kind: "income", amount: 137, date: new Date().toISOString().slice(0, 10), note: "Isolated restart verification" });
  const save = await fetch(`${origin}/api/finance`, { method: "POST", headers: { ...headers, "Idempotency-Key": requestId }, body });
  assert.equal(save.status, 200); const saved = await save.json();
  assert.equal(saved.accounts.find(row => row.id === account.id).balance, account.balance + 137);
  await stop(); console.log("Server stopped; restarting against the same isolated database."); await start();
  const restored = await (await fetch(`${origin}/api/finance`, { headers })).json();
  assert.equal(restored.accounts.find(row => row.id === account.id).balance, account.balance + 137);
  assert.deepEqual(restored.transactions, saved.transactions);
  const retry = await fetch(`${origin}/api/finance`, { method: "POST", headers: { ...headers, "Idempotency-Key": requestId }, body });
  assert.equal(retry.status, 200); assert.equal((await retry.json()).transactions.length, saved.transactions.length);
  const cleanup = await fetch(`${origin}/api/finance`, { method: "DELETE", headers, body: JSON.stringify({ confirmation: "DELETE" }) }); assert.equal(cleanup.status, 200);
  console.log("PASS: session, exact balance, ledger rows and retry identity survived a real server restart. Isolated demo deleted.");
} catch (error) {
  console.error(error instanceof assert.AssertionError ? "Persistence assertion failed." : "Persistence verification failed. Check local port, build and runtime configuration.");
  process.exitCode = 1;
} finally { await stop(); }
