import "dotenv/config";
import { getDb, closeDb } from "../src/server/db";
import { user } from "../src/server/schema";
import { seedDemoData } from "../src/server/demo";
async function main() {
  const db = await getDb();
  const userId = "mizan-seed-example";
  await db.insert(user).values({ id: userId, name: "سارة", email: "seed@example.invalid", demo: true, emailVerified: false }).onConflictDoNothing();
  await seedDemoData(userId);
  console.log("Isolated sample dataset seeded. Use Try the demo in the application to create your own private demo session.");
  await closeDb();
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
