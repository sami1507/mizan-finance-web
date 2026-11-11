import { sql } from "drizzle-orm";
import { assertConfiguration } from "./config";
import { getDb } from "./db";

const state = globalThis as unknown as { mizanReadiness?: Promise<boolean> };
const MAX_WAIT_MS = 5_000;

/** No personal data is queried; concurrent probes share one check. The five-second
 * timer bounds asynchronous waits, not synchronous PGlite filesystem bootstrap.
 * Initialize a fresh local directory with db:migrate before starting the server. */
export function isReady(): Promise<boolean> {
  if (state.mizanReadiness) return state.mizanReadiness;
  state.mizanReadiness = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      assertConfiguration(["auth", "database"]);
      const probe = (async () => { await (await getDb()).execute(sql`select 1`); return true; })();
      return await Promise.race([probe, new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), MAX_WAIT_MS); })]);
    } catch { return false; }
    finally { if (timer) clearTimeout(timer); }
  })().finally(() => { state.mizanReadiness = undefined; });
  return state.mizanReadiness;
}
