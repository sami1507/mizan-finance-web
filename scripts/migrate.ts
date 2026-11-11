import { ConfigurationError } from "../src/server/config";
import "dotenv/config";
import { getDb, closeDb } from "../src/server/db";
async function main() {
  await getDb();
  console.log("Database migrations applied successfully.");
  await closeDb();
}
main().catch(async error => { console.error(error instanceof ConfigurationError ? error.message : "Migration failed. Check configuration and database availability; no sensitive error details were logged."); await closeDb().catch(() => {}); process.exitCode = 1; });
