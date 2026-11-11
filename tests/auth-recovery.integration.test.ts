import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../src/server/db";
import { session, verification } from "../src/server/schema";
import { GET, POST } from "../src/app/api/auth/[...all]/route";
import { smtpPeer } from "./helpers/smtp-peer";

const origin = "http://localhost:3000";
const email = `reset-${randomUUID()}@example.test`;
const password = `Initial-${randomUUID()}-A1!`;
let userId = "";
async function post(path: string, body: Record<string, unknown>) {
  return POST(new Request(`${origin}/api/auth${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "x-mizan-locale": "en" }, body: JSON.stringify(body) }));
}
beforeAll(async () => {
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv("BETTER_AUTH_SECRET", "local-recovery-integration-test-secret-123456789");
  const signup = await post("/sign-up/email", { email, password, name: "Recovery integration" });
  expect(signup.ok, await signup.clone().text()).toBe(true);
  userId = (await signup.json()).user.id;
});
afterEach(() => { vi.stubEnv("SMTP_URL", ""); vi.stubEnv("MAIL_FROM", ""); });
afterAll(async () => { vi.unstubAllEnvs(); await closeDb(); });

describe("real Better Auth recovery through the HTTP handler and a local SMTP peer", () => {
  it("returns 503 when the provider rejects a message even though Better Auth swallows callback errors", async () => {
    const peer = await smtpPeer(true);
    vi.stubEnv("SMTP_URL", peer.url); vi.stubEnv("MAIL_FROM", "sender@example.test");
    try {
      const response = await post("/request-password-reset", { email, redirectTo: `${origin}/reset-password` });
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe("EMAIL_DELIVERY_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toContain(email);
      expect(peer.messages).toHaveLength(0);
      expect(peer.recipients()).toBe(1);
    } finally { await peer.close(); }
  });
  it("delivers a reset, uses its callback/token once, revokes old sessions and signs in with the new password", async () => {
    const peer = await smtpPeer();
    vi.stubEnv("SMTP_URL", peer.url); vi.stubEnv("MAIL_FROM", "sender@example.test");
    try {
      const response = await post("/request-password-reset", { email, redirectTo: `${origin}/reset-password` });
      expect(response.status).toBe(200);
      expect(peer.messages).toHaveLength(1);
      const db = await getDb();
      const records = await db.select().from(verification).where(eq(verification.value, userId));
      const record = records.filter(item => item.identifier.startsWith("reset-password:")).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const token = record.identifier.slice("reset-password:".length);
      const callback = await GET(new Request(`${origin}/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(`${origin}/reset-password`)}`));
      expect(callback.status).toBe(302);
      expect(new URL(callback.headers.get("Location")!).searchParams.get("token")).toBe(token);
      const newPassword = `Reset-${randomUUID()}-A1!`;
      expect((await post("/reset-password", { token, newPassword })).status).toBe(200);
      expect(await db.select().from(session).where(eq(session.userId, userId))).toHaveLength(0);
      expect((await post("/reset-password", { token, newPassword })).ok).toBe(false);
      expect((await post("/sign-in/email", { email, password })).ok).toBe(false);
      expect((await post("/sign-in/email", { email, password: newPassword })).ok).toBe(true);
    } finally { await peer.close(); }
  });
  it("keeps a missing account response conditional and does not fabricate a sent message", async () => {
    const peer = await smtpPeer();
    vi.stubEnv("SMTP_URL", peer.url); vi.stubEnv("MAIL_FROM", "sender@example.test");
    try {
      const response = await post("/request-password-reset", { email: `absent-${randomUUID()}@example.test`, redirectTo: `${origin}/reset-password` });
      expect(response.status).toBe(200);
      expect((await response.json()).message).toMatch(/If this email exists/);
      expect(peer.messages).toHaveLength(0);
    } finally { await peer.close(); }
  });
});
