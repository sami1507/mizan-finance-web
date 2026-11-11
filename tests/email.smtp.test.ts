import { afterEach, describe, expect, it, vi } from "vitest";
import { observeMailDelivery, sendPasswordResetEmail, verifyMailConnection } from "../src/server/email";
import { smtpPeer } from "./helpers/smtp-peer";
afterEach(() => vi.unstubAllEnvs());
describe("actual SMTP protocol over a loopback test connection", () => {
  it("verifies without a message, then transmits one reset email", async () => {
    const peer = await smtpPeer();
    vi.stubEnv("SMTP_URL", peer.url); vi.stubEnv("MAIL_FROM", "Mizan test <sender@example.test>");
    try {
      await verifyMailConnection();
      expect(peer.messages).toHaveLength(0);
      expect(peer.recipients()).toBe(0);
      await sendPasswordResetEmail("recipient@example.test", "https://mizan.example.test/reset?token=test-only", "en");
      expect(peer.messages).toHaveLength(1);
      expect(peer.messages[0]).toContain("recipient@example.test");
      expect(peer.recipients()).toBe(1);
    } finally { await peer.close(); }
  });
  it("reports SMTP rejection without retrying or reporting success", async () => {
    const peer = await smtpPeer(true);
    vi.stubEnv("SMTP_URL", peer.url); vi.stubEnv("MAIL_FROM", "Mizan test <sender@example.test>");
    try {
      const outcome = await observeMailDelivery(async () => {
        await expect(sendPasswordResetEmail("recipient@example.test", "https://mizan.example.test/reset")).rejects.toThrow("could not be confirmed");
      });
      expect(outcome.failed).toBe(true);
      expect(peer.messages).toHaveLength(0);
      expect(peer.recipients()).toBe(1);
    } finally { await peer.close(); }
  });
});
