import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import * as schema from "./schema";
import { localeSchema } from "./validation";
import { authenticationConfig } from "./config";
import { MailDeliveryError, markMailDeliveryFailed, sendPasswordResetEmail } from "./email";

async function authSecret(): Promise<string> {
  const { secret } = authenticationConfig();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required in production.");
  const directory = path.join(process.cwd(), "data");
  const secretFile = path.join(directory, ".auth-secret");
  await mkdir(directory, { recursive: true });
  try { return await readFile(secretFile, "utf8"); } catch {
    const secret = randomBytes(48).toString("hex");
    try { await writeFile(secretFile, secret, { flag: "wx", mode: 0o600 }); return secret; }
    catch { return readFile(secretFile, "utf8"); }
  }
}

async function createAuth() {
  const { baseURL } = authenticationConfig();
  const db = await getDb();
  return betterAuth({
    appName: "Mizan Finance", baseURL, secret: await authSecret(),
    database: drizzleAdapter(db, { provider: "pg", schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification } }),
    emailAndPassword: {
      enabled: true, minPasswordLength: 10, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        try {
          const [profile] = await db.select({ locale: schema.profiles.locale }).from(schema.profiles).where(eq(schema.profiles.userId, user.id));
          const preference = localeSchema.safeParse(profile?.locale);
          await sendPasswordResetEmail(user.email, url, preference.success ? preference.data : undefined);
        } catch {
          markMailDeliveryFailed();
          throw new MailDeliveryError();
        }
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 60, customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 60, max: 5 }, "/request-password-reset": { window: 60, max: 3 } } },
    advanced: { cookiePrefix: "mizan", useSecureCookies: baseURL.startsWith("https://") },
    trustedOrigins: [baseURL],
    // Better Auth's raw log arguments may contain SQL parameters or personal data.
    logger: { level: "warn", log(level) { console.error(`Mizan authentication event: ${level}. Inspect configuration and service health.`); } },
  });
}
const globalAuth = globalThis as unknown as { mizanAuth?: ReturnType<typeof createAuth> };
export async function getAuth() {
  globalAuth.mizanAuth ??= createAuth().catch(error => { globalAuth.mizanAuth = undefined; throw error; });
  return globalAuth.mizanAuth;
}
