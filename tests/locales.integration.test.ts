import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { closeDb, getDb } from "@/server/db";
import { profiles, user } from "@/server/schema";
import { deleteUserData, getSnapshot, mutateFinance } from "@/server/finance-service";
import { createDemo, seedDemoData } from "@/server/demo";
import { errorResponse, identity } from "@/server/http";
import { bilingual, localizedMessage, passwordResetEmail, requestLocale } from "@/server/messages";
import { localeSchema, profileSchema, ServiceError } from "@/server/validation";
import { POST as demoPOST } from "@/app/api/demo/route";
import { POST as financePOST, GET as financeGET } from "@/app/api/finance/route";
import { POST as authPOST } from "@/app/api/auth/[...all]/route";
import type { Locale } from "@/lib/contracts";

let ownerA: string;
let ownerB: string;
let createdUsers: string[];
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

function request(route: string, locale: Locale, body?: unknown, sessionCookie?: string): Request {
  return new Request(new URL(route, baseURL), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: new URL(baseURL).origin, "content-type": "application/json",
      cookie: `${sessionCookie ? `${sessionCookie}; ` : ""}mizan-locale=${locale}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(async () => {
  createdUsers = [];
  ownerA = randomUUID(); ownerB = randomUUID();
  const db = await getDb();
  for (const [index, id] of [ownerA, ownerB].entries()) {
    await db.insert(user).values({ id, name: "Locale test", email: `${id}@example.test`, emailVerified: false });
    createdUsers.push(id);
    await mutateFinance(id, {
      action: "onboarding", name: "Locale test", locale: index === 0 ? "ar" : "en",
      currency: "ILS", timezone: "UTC", accountName: "Original account name",
      accountType: "bank", openingBalance: 500_000,
    });
  }
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const id of createdUsers) await deleteUserData(id);
});

afterAll(async () => { await closeDb(); });

describe("four-language server support", () => {
  it("upgrades the existing two-language PostgreSQL constraint without changing saved data", async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec(await readFile(path.join(process.cwd(), "drizzle/0001_initial.sql"), "utf8"));
      await legacy.query("INSERT INTO app_user (id, name, email) VALUES ($1, $2, $3)", ["legacy-locale", "Original name", "legacy-locale@example.test"]);
      await legacy.query("INSERT INTO profiles (user_id, locale) VALUES ($1, $2)", ["legacy-locale", "ar"]);
      await expect(legacy.query("UPDATE profiles SET locale=$1 WHERE user_id=$2", ["he", "legacy-locale"])).rejects.toThrow();
      await legacy.exec(await readFile(path.join(process.cwd(), "drizzle/0003_profile_locales.sql"), "utf8"));
      expect((await legacy.query<{ locale: string }>("SELECT locale FROM profiles WHERE user_id=$1", ["legacy-locale"])).rows[0].locale).toBe("ar");
      for (const locale of ["he", "de", "en", "ar"]) {
        await legacy.query("UPDATE profiles SET locale=$1 WHERE user_id=$2", [locale, "legacy-locale"]);
        expect((await legacy.query<{ locale: string }>("SELECT locale FROM profiles WHERE user_id=$1", ["legacy-locale"])).rows[0].locale).toBe(locale);
      }
      await expect(legacy.query("UPDATE profiles SET locale=$1 WHERE user_id=$2", ["fr", "legacy-locale"])).rejects.toThrow();
      expect((await legacy.query<{ name: string }>("SELECT name FROM app_user WHERE id=$1", ["legacy-locale"])).rows[0].name).toBe("Original name");
    } finally { await legacy.close(); }
  });

  it.each(["he", "de"] as const)("persists %s profile preferences without translating existing user data or changing the other owner", async locale => {
    expect(localeSchema.parse(locale)).toBe(locale);
    const otherBefore = await getSnapshot(ownerB);
    await mutateFinance(ownerA, { action: "profile.update", locale });
    const fresh = await getSnapshot(ownerA);
    expect(fresh.profile.locale).toBe(locale);
    expect(fresh.accounts[0].name).toBe("Original account name");
    expect(fresh.accounts[0].balance).toBe(500_000);
    const db = await getDb();
    expect((await db.select().from(profiles).where(eq(profiles.userId, ownerA)))[0].locale).toBe(locale);
    expect(await getSnapshot(ownerB)).toEqual(otherBefore);
    await expect(mutateFinance(ownerA, { action: "profile.update", locale: "fr" })).rejects.toThrow();
    await expect(db.update(profiles).set({ locale: "fr" }).where(eq(profiles.userId, ownerA))).rejects.toThrow();
    expect((await getSnapshot(ownerA)).profile.locale).toBe(locale);
  });

  it.each(["he", "de"] as const)("accepts %s onboarding and returns a fully seeded demo through the API", async locale => {
    const id = randomUUID();
    await (await getDb()).insert(user).values({ id, name: "New locale user", email: `${id}@example.test`, emailVerified: false });
    createdUsers.push(id);
    await mutateFinance(id, {
      action: "onboarding", name: "New locale user", locale, currency: "ILS", timezone: "UTC",
      accountName: "User-created name", accountType: "cash", openingBalance: 123_456,
    });
    expect((await getSnapshot(id)).profile.locale).toBe(locale);
    const response = await demoPOST(request("/api/demo", locale, { locale }));
    expect(response.status).toBe(200);
    const sessionCookie = response.headers.get("set-cookie")!.split(";")[0];
    const demo = await identity(request("/api/finance", locale, undefined, sessionCookie));
    createdUsers.push(demo.id);
    expect(demo.demo).toBe(true);
    const snapshot = await getSnapshot(demo.id);
    expect(snapshot.profile.locale).toBe(locale);
    expect(snapshot.profile.name).toBe(locale === "he" ? "שרה" : "Sara");
    expect(snapshot.accounts.some(account => account.name === (locale === "he" ? "חשבון ראשי" : "Hauptkonto"))).toBe(true);
    expect(snapshot.accounts.some(account => account.name === (locale === "he" ? "ארנק בדולר" : "USD-Wallet"))).toBe(true);
    expect(snapshot.transactions.some(row => row.note === (locale === "he" ? "משכורת חודשית" : "Monatsgehalt"))).toBe(true);
    expect(snapshot.goals.some(goal => goal.name === (locale === "he" ? "קרן חירום" : "Notgroschen"))).toBe(true);
    expect(snapshot.recurring.some(row => row.name === (locale === "he" ? "מינוי אינטרנט" : "Internetabo"))).toBe(true);
    expect(snapshot.notes[0].title).toBe(locale === "he" ? "התוכנית שלי לחודש הזה" : "Mein Plan für diesen Monat");
    expect(snapshot.transfers[0].note).toBe(locale === "he" ? "העברה לחיסכון" : "Überweisung auf das Sparkonto");
    const generatedLabels = [...snapshot.accounts.map(row => row.name), ...snapshot.transactions.map(row => row.note), ...snapshot.goals.map(row => row.name), ...snapshot.recurring.map(row => row.name), ...snapshot.notes.flatMap(row => [row.title, row.body])];
    expect(generatedLabels.every(label => !/[\u0600-\u06ff]/.test(label))).toBe(true);
    expect(snapshot.accounts).toHaveLength(4);
    expect(snapshot.transactions).toHaveLength(53);
    expect(snapshot.goals.map(goal => goal.target).sort((a, b) => a - b)).toEqual([800_000, 1_500_000]);
    await seedDemoData(demo.id, locale === "he" ? "de" : "he");
    expect(await getSnapshot(demo.id)).toEqual(snapshot);
    await expect(seedDemoData(ownerA, locale)).rejects.toThrow("Sample data can only be created for a demo user.");
  });

  it("uses explicit presentation preferences before cookies and weighted browser languages", () => {
    expect(requestLocale(new Request(baseURL, { headers: { "x-mizan-locale": "he", cookie: "mizan-locale=de", "accept-language": "en-US" } }))).toBe("he");
    expect(requestLocale(new Request(baseURL, { headers: { "x-mizan-locale": "invalid", cookie: "mizan-locale=de", "accept-language": "he-IL" } }))).toBe("de");
    expect(requestLocale(new Request(baseURL, { headers: { "accept-language": "fr;q=1, de-DE;q=0.8, he-IL;q=0.9, en;q=0" } }))).toBe("he");
    expect(requestLocale(new Request(baseURL, { headers: { cookie: "mizan-locale=%E0%A4%A", "accept-language": "de-DE" } }))).toBe("de");
    expect(requestLocale(new Request(baseURL, { headers: { "accept-language": "fr, en;q=0" } }))).toBeUndefined();
    expect(requestLocale()).toBeUndefined();
  });

  it.each(["he", "de"] as const)("returns exact localized %s service and validation errors with unchanged status codes", async locale => {
    const response = errorResponse(new ServiceError("Account not found.", 404), request("/api/finance", locale));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: locale === "he" ? "החשבון לא נמצא." : "Das Konto wurde nicht gefunden." });
    const parsed = profileSchema.safeParse({ name: "Name", locale: "fr", currency: "ILS", timezone: "UTC" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const invalid = errorResponse(parsed.error, request("/api/finance", locale));
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toEqual({ error: locale === "he" ? "שפה: ערך לא תקין" : "Sprache: Ungültiger Wert" });
    }
    expect(localizedMessage("Invalid email or password", locale, "INVALID_EMAIL_OR_PASSWORD")).toBe(locale === "he" ? "כתובת הדוא״ל או הסיסמה שגויה." : "Die E-Mail-Adresse oder das Passwort ist falsch.");
    const generic = locale === "he" ? "לא ניתן להשלים את הבקשה. יש לנסות שוב." : "Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.";
    expect(localizedMessage("Unknown internal message", locale)).toBe(generic);
    expect(localizedMessage("constructor", locale, "toString")).toBe(generic);
  });

  it.each(["he", "de"] as const)("builds a %s password-reset email from the stored preference without sending mail", async locale => {
    await mutateFinance(ownerA, { action: "profile.update", locale });
    const profile = (await getSnapshot(ownerA)).profile;
    const url = "https://mizan.example/reset-password?token=example-token";
    const message = passwordResetEmail(profile.locale, url);
    expect(message.subject).toBe(locale === "he" ? "Mizan | איפוס הסיסמה" : "Mizan | Passwort zurücksetzen");
    expect(message.text).toBe(locale === "he"
      ? `לאיפוס הסיסמה שלך ב-Mizan Finance, יש לפתוח את הקישור הבא:\n\n${url}\n\nאם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מההודעה הזו.`
      : `Öffne diesen Link, um dein Passwort für Mizan Finance zurückzusetzen:\n\n${url}\n\nFalls du keine Zurücksetzung angefordert hast, kannst du diese Nachricht ignorieren.`);
    expect(message.text.split(url)).toHaveLength(2);
    expect((await getSnapshot(ownerB)).profile.locale).toBe("en");
    expect(passwordResetEmail("ar", url)).toEqual(passwordResetEmail("en", url));
    expect(passwordResetEmail(undefined, url)).toEqual(passwordResetEmail("ar", url));
  });

  it.each(["he", "de"] as const)("keeps ownership and authentication checks intact when %s is supplied by an untrusted cookie", async locale => {
    const demo = await createDemo(locale); createdUsers.push(demo.userId);
    const demoBefore = await getSnapshot(demo.userId);
    const otherBefore = await getSnapshot(ownerB);
    const forbidden = await financePOST(request("/api/finance", locale, {
      action: "transaction.create", userId: ownerB, accountId: otherBefore.accounts[0].id,
      categoryId: demoBefore.categories.find(category => category.kind === "expense")!.id,
      kind: "expense", amount: 100, currency: "ILS", date: new Date().toISOString().slice(0, 10), note: "Must not be saved",
    }, `mizan_demo=${demo.token}`));
    expect(forbidden.status).toBe(404);
    expect(await forbidden.json()).toEqual({ error: locale === "he" ? "החשבון לא נמצא." : "Das Konto wurde nicht gefunden." });
    expect(await getSnapshot(ownerB)).toEqual(otherBefore);
    expect(await getSnapshot(demo.userId)).toEqual(demoBefore);
    const unauthenticated = await financeGET(request("/api/finance", locale, undefined, "mizan_demo=invalid"));
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: locale === "he" ? "תוקף ההתחברות פג. יש להתחבר מחדש." : "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." });
  });

  it.each(["he", "de"] as const)("localizes unavailable password recovery in %s without claiming email was sent", async locale => {
    vi.stubEnv("SMTP_URL", ""); vi.stubEnv("MAIL_FROM", "");
    const response = await authPOST(request("/api/auth/request-password-reset", locale, { email: "locale-test@example.test" }));
    expect(response.status).toBe(503);
    const message = locale === "he" ? "שחזור סיסמה אינו זמין כרגע. יש לפנות למנהל המערכת." : "Die Passwortwiederherstellung ist derzeit nicht verfügbar. Wende dich an die Administration.";
    expect(await response.json()).toEqual({ code: "EMAIL_NOT_CONFIGURED", message, error: message });
  });

  it("preserves Arabic/English fallback messages and rejects unsupported demo locales", async () => {
    for (const locale of [undefined, "ar", "en"] as const) {
      expect(localizedMessage("Account not found.", locale)).toBe(bilingual("Account not found."));
    }
    const response = await demoPOST(request("/api/demo", "de", { locale: "fr" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Sprache: Ungültiger Wert" });
  });
});
