import "dotenv/config";
import { cleanExpiredDemos } from "../src/server/demo";
import { closeDb } from "../src/server/db";
async function main() {
  console.log(`Removed ${await cleanExpiredDemos()} expired demo datasets.`);
  await closeDb();
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Cleanup failed"); process.exitCode = 1; });
