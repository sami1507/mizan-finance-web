import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle as pgDrizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";
import { databaseConfig } from "./config";

export type Database = NodePgDatabase<typeof schema>;
type Connection = { db: Database; close: () => Promise<void> };
const globalDb = globalThis as unknown as { mizanDb?: Promise<Connection> };

export const postgresLimits = {
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  query_timeout: 20_000,
  statement_timeout: 15_000,
  idle_in_transaction_session_timeout: 15_000,
};

async function connect(): Promise<Connection> {
  const config = databaseConfig();
  const databaseUrl = config.url;
  const migrationDir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(migrationDir)).filter(name => name.endsWith(".sql")).sort();
  if (databaseUrl) {
    const pool = new Pool({ connectionString: databaseUrl, ...postgresLimits });
    // An idle socket can fail after startup; never let an unhandled pool event crash
    // the process or log raw provider messages containing connection details.
    pool.on("error", () => console.error("Mizan database idle connection failed. Check database availability."));
    let connection: PoolClient | undefined;
    let locked = false;
    try {
      connection = await pool.connect();
      await connection.query("SELECT pg_advisory_lock(1296652890)");
      locked = true;
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
      await connection.query("SELECT pg_advisory_unlock(1296652890)");
      locked = false;
      connection.release();
      connection = undefined;
    } catch (error) {
      if (connection) {
        if (locked) { try { await connection.query("SELECT pg_advisory_unlock(1296652890)"); } catch { /* Destroying the session releases its advisory locks. */ } }
        connection.release(true);
      }
      await pool.end();
      throw error;
    }
    return { db: pgDrizzle(pool, { schema }), close: () => pool.end() };
  }
  const directory = config.directory;
  if (directory !== ":memory:") await mkdir(directory, { recursive: true });
  const client = new PGlite(directory === ":memory:" ? undefined : directory);
  try {
    await client.waitReady;
    await client.exec("CREATE TABLE IF NOT EXISTS mizan_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of files) {
      if ((await client.query("SELECT name FROM mizan_migrations WHERE name=$1", [name])).rows.length) continue;
      await client.transaction(async tx => {
        await tx.exec(await readFile(path.join(migrationDir, name), "utf8"));
        await tx.query("INSERT INTO mizan_migrations(name) VALUES ($1)", [name]);
      });
    }
  } catch (error) { try { await client.close(); } catch { /* Preserve the initialization error. */ } throw error; }
  return { db: pgliteDrizzle(client, { schema }) as unknown as Database, close: () => client.close() };
}

export async function getDb(): Promise<Database> {
  globalDb.mizanDb ??= connect().catch(error => { globalDb.mizanDb = undefined; throw error; });
  return (await globalDb.mizanDb).db;
}
export async function closeDb() {
  if (globalDb.mizanDb) { const pending = globalDb.mizanDb; globalDb.mizanDb = undefined; await (await pending).close(); }
}
