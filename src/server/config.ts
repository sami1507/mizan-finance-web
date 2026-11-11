import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;
export type ConfigurationArea = "database" | "auth" | "email";
export type ConfigurationIssue = { area: ConfigurationArea; message: string };
export class ConfigurationError extends Error {
  constructor(public readonly issues: ConfigurationIssue[]) {
    super(issues.map(issue => issue.message).join(" "));
    this.name = "ConfigurationError";
  }
}

const value = (env: Environment, key: string) => env[key]?.trim() || undefined;
export function isLoopback(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}
function parseUrl(input: string | undefined): URL | undefined {
  if (!input) return undefined;
  try { return new URL(input); } catch { return undefined; }
}
function safePort(url: URL): boolean { return !url.port || Number(url.port) > 0 && Number(url.port) <= 65535; }
function originUrl(env: Environment): URL | undefined {
  return parseUrl(value(env, "BETTER_AUTH_URL") || (env.NODE_ENV === "production" ? undefined : "http://localhost:3000"));
}
export function isLocalPreview(env: Environment): boolean {
  const url = originUrl(env);
  return env.ALLOW_LOCAL_DB === "true" && !!url && isLoopback(url.hostname);
}

/** Only key names and fixed messages are returned: never interpolate environment values. */
export function inspectConfiguration(env: Environment = process.env): { issues: ConfigurationIssue[]; warnings: string[]; email: "configured" | "unavailable" | "invalid" } {
  const issues: ConfigurationIssue[] = [];
  const warnings: string[] = [];
  const add = (area: ConfigurationArea, message: string) => issues.push({ area, message });
  const production = env.NODE_ENV === "production";
  const preview = isLocalPreview(env);
  const localFlag = value(env, "ALLOW_LOCAL_DB");
  if (localFlag && !["true", "false"].includes(localFlag)) add("database", "ALLOW_LOCAL_DB must be true or false.");
  if (production && localFlag === "true" && !preview) add("database", "ALLOW_LOCAL_DB=true is allowed only with an explicit loopback BETTER_AUTH_URL for a local preview.");
  const database = value(env, "DATABASE_URL");
  if (database) {
    const url = parseUrl(database);
    if (!url || !["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1) || url.hash || !safePort(url)) {
      add("database", "DATABASE_URL must be a PostgreSQL connection URL with a host, user and database name.");
    } else if (production && !isLoopback(url.hostname) && url.searchParams.get("sslmode") !== "verify-full") {
      warnings.push("Use your provider's certificate-verified PostgreSQL TLS settings; sslmode=verify-full is recommended for a publicly reachable database.");
    }
  } else if (production && !preview) add("database", "DATABASE_URL is required for production. PGlite is available only in development or an explicit local preview.");
  else warnings.push("Using a local PGlite database. Run one application process per data directory.");
  if (production && value(env, "PGLITE_DATA_DIR") === ":memory:" && !database) add("database", "A local production preview requires a persistent PGLITE_DATA_DIR, not :memory:.");

  const url = originUrl(env);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname) || !safePort(url)) {
    add("auth", "BETTER_AUTH_URL must be the application origin, without credentials, a path, a query or a fragment.");
  } else if (production && !preview && url.protocol !== "https:") add("auth", "Production BETTER_AUTH_URL must use HTTPS.");
  if (production && !value(env, "BETTER_AUTH_URL")) add("auth", "BETTER_AUTH_URL must be explicitly configured in production.");
  const secret = value(env, "BETTER_AUTH_SECRET");
  if (secret && secret.length < 32) add("auth", "BETTER_AUTH_SECRET must contain at least 32 characters.");
  if (production && !secret) add("auth", "BETTER_AUTH_SECRET is required in production. Generate a random secret before deployment.");
  if (!production && !secret) warnings.push("Development generates a local authentication secret under data/. Keep that directory private.");

  const smtp = value(env, "SMTP_URL");
  const from = value(env, "MAIL_FROM");
  if (!smtp && !from) return { issues, warnings: [...warnings, "Password recovery is unavailable until SMTP_URL and MAIL_FROM are configured."], email: "unavailable" };
  if (!smtp || !from) add("email", "Configure both SMTP_URL and MAIL_FROM, or leave both empty to disable password recovery.");
  if (smtp) {
    const smtpUrl = parseUrl(smtp);
    if (!smtpUrl || !["smtp:", "smtps:"].includes(smtpUrl.protocol) || !smtpUrl.hostname || !safePort(smtpUrl) || !["", "/"].includes(smtpUrl.pathname) || smtpUrl.search || smtpUrl.hash) {
      add("email", "SMTP_URL must use smtp:// or smtps:// with a host and optional port and credentials; paths, query options and fragments are not supported.");
    } else {
      try {
        const user = decodeURIComponent(smtpUrl.username), password = decodeURIComponent(smtpUrl.password);
        if (!!user !== !!password || /[\r\n\u0000]/.test(user + password)) add("email", "SMTP_URL credentials must include both a username and password, with special characters URL-encoded.");
      } catch { add("email", "SMTP_URL credentials contain invalid URL encoding."); }
      if (smtpUrl.protocol === "smtp:" && smtpUrl.port === "465") add("email", "SMTP_URL must use smtps:// for port 465 (TLS from connection start).");
    }
  }
  if (from && !validSender(from)) add("email", "MAIL_FROM must contain one email address, optionally written as Mizan Finance <address@example.com>, without line breaks.");
  return { issues, warnings, email: issues.some(issue => issue.area === "email") ? "invalid" : "configured" };
}

function validSender(sender: string): boolean {
  if (/[\r\n\u0000,;]/.test(sender) || sender.length > 320) return false;
  const match = sender.match(/^[^<>]+<([^<>]+)>$/);
  return z.email().safeParse(match ? match[1] : sender).success;
}
export function assertConfiguration(areas: readonly ConfigurationArea[], env: Environment = process.env): void {
  const issues = inspectConfiguration(env).issues.filter(issue => areas.includes(issue.area));
  if (issues.length) throw new ConfigurationError(issues);
}
export function authenticationConfig(env: Environment = process.env) {
  assertConfiguration(["auth"], env);
  return { baseURL: originUrl(env)!.origin, secret: value(env, "BETTER_AUTH_SECRET") };
}
export function databaseConfig(env: Environment = process.env) {
  assertConfiguration(["database"], env);
  return { url: value(env, "DATABASE_URL"), directory: value(env, "PGLITE_DATA_DIR") || "data/pglite" };
}
export function mailConfig(env: Environment = process.env) {
  assertConfiguration(["email"], env);
  const smtp = value(env, "SMTP_URL"), from = value(env, "MAIL_FROM");
  if (!smtp || !from) return undefined;
  const url = new URL(smtp);
  const localTest = isLoopback(url.hostname) && (env.NODE_ENV !== "production" || isLocalPreview(env));
  return {
    from,
    options: {
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port: Number(url.port || (url.protocol === "smtps:" ? 465 : 587)),
      secure: url.protocol === "smtps:",
      requireTLS: !localTest,
      auth: url.username ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      dnsTimeout: 5_000,
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" as const },
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false as const,
      debug: false,
      pool: false as const,
    },
  };
}
