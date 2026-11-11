import { describe, expect, it } from "vitest";
import { assertConfiguration, authenticationConfig, databaseConfig, inspectConfiguration, isLoopback, mailConfig } from "../src/server/config";

const production = {
  NODE_ENV: "production", DATABASE_URL: "postgresql://operator:test-only@db.example.test/mizan?sslmode=verify-full",
  BETTER_AUTH_URL: "https://mizan.example.test", BETTER_AUTH_SECRET: "configuration-test-only-secret-longer-than-32",
};
describe("service configuration", () => {
  it("allows clean local development without external services and reports recovery unavailable", () => {
    expect(inspectConfiguration({}).issues).toEqual([]);
    expect(inspectConfiguration({}).email).toBe("unavailable");
    expect(databaseConfig({})).toEqual({ url: undefined, directory: "data/pglite" });
    expect(authenticationConfig({}).baseURL).toBe("http://localhost:3000");
  });
  it("requires a database, explicit canonical URL and secret for production", () => {
    const messages = inspectConfiguration({ NODE_ENV: "production" }).issues.map(issue => issue.message).join(" ");
    expect(messages).toContain("DATABASE_URL");
    expect(messages).toContain("BETTER_AUTH_URL");
    expect(messages).toContain("BETTER_AUTH_SECRET");
  });
  it("accepts a complete production configuration without optional email", () => {
    expect(inspectConfiguration(production).issues).toEqual([]);
    expect(inspectConfiguration(production).email).toBe("unavailable");
  });
  it.each(["http://mizan.example.test", "https://x:y@mizan.example.test", "https://mizan.example.test/subpath", "https://mizan.example.test/?secret=x", "https://mizan.example.test/#a"])("rejects an unsafe/non-origin production auth URL %s", url => {
    expect(() => authenticationConfig({ ...production, BETTER_AUTH_URL: url })).toThrow("BETTER_AUTH_URL");
  });
  it.each(["https://database.example.test/mizan", "postgresql://user@/db", "postgresql://user@host", "not-a-url"])("rejects invalid database URLs %s", url => {
    expect(() => databaseConfig({ DATABASE_URL: url })).toThrow("DATABASE_URL");
  });
  it("rejects a public deployment masquerading as a local preview", () => {
    expect(() => databaseConfig({ ...production, DATABASE_URL: "", ALLOW_LOCAL_DB: "true" })).toThrow("loopback");
  });
  it("permits an explicit loopback production preview but still requires a secret", () => {
    const preview = { NODE_ENV: "production", ALLOW_LOCAL_DB: "true", BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: production.BETTER_AUTH_SECRET };
    expect(inspectConfiguration(preview).issues).toEqual([]);
    expect(() => authenticationConfig({ ...preview, BETTER_AUTH_SECRET: "" })).toThrow("BETTER_AUTH_SECRET");
    expect(() => databaseConfig({ ...preview, PGLITE_DATA_DIR: ":memory:" })).toThrow("persistent");
  });
  it("does not mistake similar domains or non-loopback addresses for localhost", () => {
    expect(isLoopback("localhost.attacker.test")).toBe(false);
    expect(isLoopback("192.168.0.1")).toBe(false);
    expect(isLoopback("[::1]")).toBe(true);
  });
  it("isolates invalid optional SMTP from core application configuration", () => {
    const env = { ...production, SMTP_URL: "smtp://mail.example.test" };
    expect(inspectConfiguration(env).email).toBe("invalid");
    expect(() => assertConfiguration(["auth", "database"], env)).not.toThrow();
    expect(() => mailConfig(env)).toThrow("MAIL_FROM");
  });
  it.each(["smtp://mail.example.test/?tls.rejectUnauthorized=false", "https://mail.example.test", "smtp://mail.example.test/messages", "smtp://mail.example.test:465", "smtp://u:%zz@mail.example.test"])("rejects unsafe SMTP syntax %s", url => {
    expect(() => mailConfig({ SMTP_URL: url, MAIL_FROM: "mizan@example.test" })).toThrow("SMTP_URL");
  });
  it.each(["first@example.test,second@example.test", "Mizan <first@example.test>\r\nBcc: second@example.test", "not-an-email"])("rejects invalid sender %s", from => {
    expect(() => mailConfig({ SMTP_URL: "smtps://mail.example.test", MAIL_FROM: from })).toThrow("MAIL_FROM");
  });
  it("sets verified TLS, bounded timeouts and decoded credentials for remote SMTP", () => {
    const config = mailConfig({ SMTP_URL: "smtp://user%40example.test:pass%3Aword@mail.example.test:587", MAIL_FROM: "Mizan Finance <mizan@example.test>" })!;
    expect(config.options.auth).toEqual({ user: "user@example.test", pass: "pass:word" });
    expect(config.options.requireTLS).toBe(true);
    expect(config.options.tls.rejectUnauthorized).toBe(true);
    expect(config.options.connectionTimeout).toBeLessThanOrEqual(10_000);
    expect(config.options.socketTimeout).toBeLessThanOrEqual(15_000);
    expect(config.options.disableFileAccess).toBe(true);
    expect(config.options.disableUrlAccess).toBe(true);
  });
  it("permits plaintext only for loopback tests, not a real production app", () => {
    const smtp = { SMTP_URL: "smtp://127.0.0.1:1025", MAIL_FROM: "mizan@example.test" };
    expect(mailConfig(smtp)!.options.requireTLS).toBe(false);
    expect(mailConfig({ ...production, ...smtp })!.options.requireTLS).toBe(true);
  });
  it("does not print secret values in validation errors", () => {
    const result = inspectConfiguration({ NODE_ENV: "production", DATABASE_URL: "secret-db-url", BETTER_AUTH_SECRET: "secret-too-short", SMTP_URL: "secret-smtp-url", MAIL_FROM: "secret-invalid-email" });
    expect(JSON.stringify(result)).not.toMatch(/secret-db-url|secret-too-short|secret-smtp-url|secret-invalid-email/);
  });
});
