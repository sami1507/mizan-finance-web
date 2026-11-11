import { ConfigurationError } from "../src/server/config";
import "dotenv/config";
import { cleanExpiredDemos } from "../src/server/demo";
import { closeDb } from "../src/server/db";
async function main() {
  console.log(`Removed ${await cleanExpiredDemos()} expired demo datasets.`);
  await closeDb();
}
main().catch(async error => { console.error(error instanceof ConfigurationError ? error.message : "Demo cleanup failed. Check configuration and database availability; no sensitive error details were logged."); await closeDb().catch(() => {}); process.exitCode = 1; });
