import { afterEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ getDb: vi.fn(), execute: vi.fn() }));
vi.mock("../src/server/db", () => ({ getDb: database.getDb }));
import { isReady } from "../src/server/health";
import { GET } from "../src/app/api/health/route";

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("health boundary", () => {
  it("serves liveness without accessing a database or exposing configuration", async () => {
    const response = await GET(new Request("http://localhost/api/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "alive" });
    expect(database.getDb).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("requires a successful database query for readiness", async () => {
    database.getDb.mockResolvedValue({ execute: database.execute }); database.execute.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/health?check=ready"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(database.execute).toHaveBeenCalledTimes(1);
  });
  it("returns a generic failure without provider details", async () => {
    database.getDb.mockRejectedValue(new Error("private-database-url-and-password"));
    const response = await GET(new Request("http://localhost/api/health?check=ready"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
  it("bounds asynchronous readiness waits to five seconds and coalesces simultaneous requests", async () => {
    vi.useFakeTimers();
    database.getDb.mockReturnValue(new Promise(() => {}));
    const first = isReady(), second = isReady();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await first).toBe(false); expect(await second).toBe(false);
    expect(database.getDb).toHaveBeenCalledTimes(1);
  });
  it("fails closed when production authentication is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("BETTER_AUTH_URL", ""); vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(await isReady()).toBe(false);
    expect(database.getDb).not.toHaveBeenCalled();
  });
});
