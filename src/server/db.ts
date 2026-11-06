import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle as pgDrizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
type Connection = { db: Database; close: () => Promise<void> };
const globalDb = globalThis as unknown as { mizanDb?: Promise<Connection> };

async function connect(): Promise<Connection> {
  const databaseUrl = process.env.DATABASE_URL;
  const migrationDir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(migrationDir)).filter(name => name.endsWith(".sql")).sort();
  if (databaseUrl) {
    const pool = new Pool({ connectionString: databaseUrl, max: 10 });
    const connection = await pool.connect();
    try {
      await connection.query("SELECT pg_advisory_lock(1296652890)");
      await connection.query("CREATE TABLE IF NOT EXISTS mizan_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
      for (const name of files) {
        if ((await connection.query("SELECT name FROM mizan_migrations WHERE name=$1", [name])).rowCount) continue;
        await connection.query("BEGIN");
        try {
          await connection.query(await readFile(path.join(migrationDir, name), "utf8"));
          await connection.query("INSERT INTO mizan_migrations(name) VALUES ($1)", [name]);
          await connection.query("COMMIT");
        } catch (error) { await connection.query("ROLLBACK"); throw error; }
      }
    } finally { await connection.query("SELECT pg_advisory_unlock(1296652890)"); connection.release(); }
    return { db: pgDrizzle(pool, { schema }), close: () => pool.end() };
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DB !== "true") {
    throw new Error("DATABASE_URL is required in production. Set ALLOW_LOCAL_DB=true only for a single-process local production preview.");
  }
  const directory = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), "data", "pglite");
  if (directory !== ":memory:") await mkdir(directory, { recursive: true });
  const client = new PGlite(directory === ":memory:" ? undefined : directory);
  await client.waitReady;
  await client.exec("CREATE TABLE IF NOT EXISTS mizan_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of files) {
    if ((await client.query("SELECT name FROM mizan_migrations WHERE name=$1", [name])).rows.length) continue;
    await client.transaction(async tx => {
      await tx.exec(await readFile(path.join(migrationDir, name), "utf8"));
      await tx.query("INSERT INTO mizan_migrations(name) VALUES ($1)", [name]);
    });
  }
  return { db: pgliteDrizzle(client, { schema }) as unknown as Database, close: () => client.close() };
}

export async function getDb(): Promise<Database> {
  globalDb.mizanDb ??= connect().catch(error => { globalDb.mizanDb = undefined; throw error; });
  return (await globalDb.mizanDb).db;
}
export async function closeDb() {
  if (globalDb.mizanDb) { await (await globalDb.mizanDb).close(); globalDb.mizanDb = undefined; }
}
