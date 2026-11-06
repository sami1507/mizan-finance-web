import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import * as schema from "./schema";

async function authSecret(): Promise<string> {
  if (process.env.BETTER_AUTH_SECRET) {
    if (process.env.BETTER_AUTH_SECRET.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
    return process.env.BETTER_AUTH_SECRET;
  }
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
  const db = await getDb();
  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return betterAuth({
    appName: "Mizan Finance", baseURL, secret: await authSecret(),
    database: drizzleAdapter(db, { provider: "pg", schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification } }),
    emailAndPassword: {
      enabled: true, minPasswordLength: 10, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!process.env.SMTP_URL || !process.env.MAIL_FROM) throw new Error("Password recovery requires SMTP_URL and MAIL_FROM.");
        const transport = nodemailer.createTransport(process.env.SMTP_URL);
        await transport.sendMail({ from: process.env.MAIL_FROM, to: user.email, subject: "Mizan | Reset your password — إعادة تعيين كلمة المرور", text: `Reset your Mizan Finance password / إعادة تعيين كلمة مرور ميزان:\n\n${url}\n\nIf you did not request this, ignore this message.\nإن لم تطلب ذلك، تجاهل هذه الرسالة.` });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 60, customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 60, max: 5 }, "/request-password-reset": { window: 60, max: 3 } } },
    advanced: { cookiePrefix: "mizan", useSecureCookies: baseURL.startsWith("https://") },
    trustedOrigins: [baseURL],
  });
}
const globalAuth = globalThis as unknown as { mizanAuth?: ReturnType<typeof createAuth> };
export async function getAuth() {
  globalAuth.mizanAuth ??= createAuth().catch(error => { globalAuth.mizanAuth = undefined; throw error; });
  return globalAuth.mizanAuth;
}
