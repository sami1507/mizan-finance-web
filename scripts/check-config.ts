import "dotenv/config";
import { inspectConfiguration, databaseConfig, ConfigurationError } from "../src/server/config";
import { verifyMailConnection } from "../src/server/email";

async function main() {
  const flags = new Set(process.argv.slice(2));
  if ([...flags].some(flag => !["--production", "--database", "--smtp"].includes(flag))) throw new Error("Usage: npm run check:config -- [--production] [--database] [--smtp]");
  if (flags.has("--production")) Object.assign(process.env, { NODE_ENV: "production" });
  const report = inspectConfiguration();
  console.log(`Configuration mode: ${process.env.NODE_ENV === "production" ? "production / explicit local preview" : "development"}. Values are never printed.`);
  for (const issue of report.issues) console.error(`ERROR [${issue.area}]: ${issue.message}`);
  for (const warning of report.warnings) console.warn(`NOTE: ${warning}`);
  if (report.issues.length) { process.exitCode = 1; return; }
  console.log(`Configuration syntax passed. Password recovery: ${report.email}. This does not prove service connectivity or email delivery.`);
  if (flags.has("--database")) {
    const config = databaseConfig();
    if (!config.url) throw new Error("--database requires DATABASE_URL. For local PGlite, initialize with npm run db:migrate and check /api/health?check=ready.");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: config.url, max: 1, connectionTimeoutMillis: 5_000, query_timeout: 5_000, statement_timeout: 5_000 });
    pool.on("error", () => console.error("Database connectivity check failed. No connection details were logged."));
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL connection and SELECT 1 passed. No migrations or financial changes were made.");
    } catch { throw new Error("PostgreSQL verification failed. Check the provider status, connection details, TLS certificate and network allowlist."); }
    finally { await pool.end(); }
  }
  if (flags.has("--smtp")) {
    try { await verifyMailConnection(); }
    catch { throw new Error("SMTP verification failed. Check SMTP_URL, provider credentials, TLS, network access and whether SMTP sending is enabled."); }
    console.log("SMTP connection and authentication passed. No email was sent; sender authorization and inbox delivery still require a live reset test.");
  }
}
main().catch(error => {
  // All caught messages here are our fixed, operator-facing strings. Never print raw provider errors.
  console.error(error instanceof ConfigurationError || error instanceof Error ? error.message : "Configuration check failed.");
  process.exitCode = 1;
});
