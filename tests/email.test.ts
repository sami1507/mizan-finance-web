import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), verify: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));
import { markMailDeliveryFailed, observeMailDelivery, sendPasswordResetEmail, verifyMailConnection } from "../src/server/email";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SMTP_URL", "smtps://user:password@mail.example.test:465");
  vi.stubEnv("MAIL_FROM", "Mizan <sender@example.test>");
  smtp.createTransport.mockReturnValue(smtp);
  smtp.sendMail.mockResolvedValue({ accepted: ["recipient@example.test"], rejected: [] });
  smtp.verify.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("password recovery mail boundary", () => {
  it("sends one localized reset message and closes the transport", async () => {
    await sendPasswordResetEmail("recipient@example.test", "https://mizan.example.test/reset?token=synthetic", "de");
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    expect(smtp.sendMail.mock.calls[0][0]).toMatchObject({ to: "recipient@example.test", subject: "Mizan | Passwort zurücksetzen" });
    expect(smtp.sendMail.mock.calls[0][0].text).toContain("https://mizan.example.test/reset?token=synthetic");
    expect(smtp.close).toHaveBeenCalledTimes(1);
  });
  it("rejects empty or partially rejected provider acceptance without retrying", async () => {
    smtp.sendMail.mockResolvedValue({ accepted: [], rejected: ["recipient@example.test"] });
    await expect(sendPasswordResetEmail("recipient@example.test", "https://mizan.example.test/reset")).rejects.toThrow("could not be confirmed");
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    expect(smtp.close).toHaveBeenCalledTimes(1);
  });
  it("sanitizes provider errors and remembers failure even if the auth library catches it", async () => {
    smtp.sendMail.mockRejectedValue(new Error("smtp://secret:password@provider recipient@example.test private-token"));
    const outcome = await observeMailDelivery(async () => {
      try { await sendPasswordResetEmail("recipient@example.test", "https://mizan.example.test/reset"); }
      catch (error) { expect(String(error)).not.toMatch(/password@|recipient@|private-token/); }
      return "auth library returned OK";
    });
    expect(outcome).toEqual({ result: "auth library returned OK", failed: true });
  });
  it("keeps concurrent requests isolated", async () => {
    let release: () => void = () => {};
    const wait = new Promise<void>(resolve => { release = resolve; });
    const failure = observeMailDelivery(async () => { await wait; markMailDeliveryFailed(); return "failure"; });
    const success = observeMailDelivery(async () => { release(); await Promise.resolve(); return "success"; });
    expect(await failure).toEqual({ result: "failure", failed: true });
    expect(await success).toEqual({ result: "success", failed: false });
  });
  it("checks SMTP connectivity without sending an email", async () => {
    await verifyMailConnection();
    expect(smtp.verify).toHaveBeenCalledTimes(1);
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(smtp.close).toHaveBeenCalledTimes(1);
  });
  it("fails explicitly when optional SMTP is absent", async () => {
    vi.stubEnv("SMTP_URL", ""); vi.stubEnv("MAIL_FROM", "");
    await expect(sendPasswordResetEmail("recipient@example.test", "https://mizan.example.test/reset")).rejects.toThrow("could not be confirmed");
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
});
