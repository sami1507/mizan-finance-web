import { describe, expect, it, vi } from "vitest";
import { checkOrigin, errorResponse, readJson } from "@/server/http";

const url = "http://localhost:3000/api/finance";
const encoder = new TextEncoder();

function streamed(chunks: Uint8Array[], extra: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...extra },
    body: new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }),
    duplex: "half",
  } as RequestInit);
}

describe("streamed request validation", () => {
  it("decodes split UTF-8 characters without corrupting Arabic and Hebrew values", async () => {
    const input = { note: "ميزان · שלום · €" };
    const bytes = encoder.encode(JSON.stringify(input));
    expect(await readJson(streamed([...bytes].map(byte => new Uint8Array([byte]))), bytes.length)).toEqual(input);
  });

  it("enforces byte limits even when Content-Length is absent or dishonest", async () => {
    const bytes = encoder.encode(JSON.stringify({ note: "א".repeat(30) }));
    const headerCases: Record<string, string>[] = [{}, { "Content-Length": "1" }];
    for (const headers of headerCases) {
      await expect(readJson(streamed([bytes.slice(0, 10), bytes.slice(10)], headers), 32)).rejects.toMatchObject({ status: 413 });
    }
  });

  it("rejects declared oversized requests before decoding and malformed JSON", async () => {
    await expect(readJson(streamed([encoder.encode("{}")], { "Content-Length": "100" }), 32)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(streamed([encoder.encode('{"note":')]))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(new Request(url, { method: "POST" }))).rejects.toMatchObject({ status: 400 });
  });
});

describe("mutation origin and private error responses", () => {
  it("requires the configured exact origin and JSON content type", () => {
    const previous = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://mizan.example";
    try {
      for (const origin of [undefined, "null", "https://mizan.example.attacker.invalid", "http://mizan.example", "https://mizan.example:8443"]) {
        const headers = new Headers({ "Content-Type": "application/json" });
        if (origin) headers.set("Origin", origin);
        expect(() => checkOrigin(new Request(url, { method: "POST", headers }))).toThrow();
      }
      expect(() => checkOrigin(new Request(url, { method: "POST", headers: { Origin: "https://mizan.example", "Content-Type": "application/json; charset=utf-8" } }))).not.toThrow();
      expect(() => checkOrigin(new Request(url, { method: "POST", headers: { Origin: "https://mizan.example", "Content-Type": "text/plain" } }))).toThrow();
    } finally {
      if (previous === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = previous;
    }
  });

  it("does not expose internal errors or financial payloads in the response or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = errorResponse(new Error("password=never-log-this; account=private-account; SQL SELECT secret"), new Request(url));
      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await response.text()).not.toMatch(/never-log-this|private-account|SQL SELECT/);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/never-log-this|private-account|SQL SELECT/);
    } finally { log.mockRestore(); }
  });
});
