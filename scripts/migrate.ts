import "dotenv/config";
import { getDb, closeDb } from "../src/server/db";
async function main() {
  await getDb();
  console.log("Database migrations applied successfully.");
  await closeDb();
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; });
