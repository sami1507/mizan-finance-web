import { and, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { demoSessions, user } from "./schema";
import { ServiceError } from "./validation";
import { localizedMessage, requestLocale, validationLabel } from "./messages";

export const DEMO_COOKIE = "mizan_demo";
export const noStore = { "Cache-Control": "private, no-store, max-age=0" };
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function cookieValue(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function demoCookie(token: string, maxAge = 86400) {
  const secure = process.env.BETTER_AUTH_URL?.startsWith("https://") ? "; Secure" : "";
  return `${DEMO_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
export async function identity(request: Request): Promise<{ id: string; demo: boolean }> {
  const token = cookieValue(request, DEMO_COOKIE);
  if (token) {
    const db = await getDb();
    const [demo] = await db.select({ id: demoSessions.userId }).from(demoSessions).innerJoin(user, eq(user.id, demoSessions.userId)).where(and(eq(demoSessions.tokenHash, hashToken(token)), gt(demoSessions.expiresAt, new Date()), eq(user.demo, true)));
    if (demo) return { id: demo.id, demo: true };
    // An expired demo must never silently fall back to a real session in the same browser.
    throw new ServiceError("Session expired. Please sign in again.", 401);
  }
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) throw new ServiceError("Please sign in to continue.", 401);
  return { id: session.user.id, demo: false };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (origin !== expected) throw new ServiceError("This request origin is not allowed.", 403);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new ServiceError("Send JSON data.", 415);
}
export async function readJson(request: Request, maximumBytes = 2_000_000): Promise<unknown> {
  const tooLarge = () => new ServiceError(maximumBytes === 2_000_000 ? "The import is too large. Use up to 2,000 rows." : "The request is too large.", 413);
  if (Number(request.headers.get("content-length") || 0) > maximumBytes) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError("Invalid JSON data.");
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximumBytes) { await reader.cancel(); throw tooLarge(); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new ServiceError("Invalid JSON data."); }
}
export function errorResponse(error: unknown, request?: Request): Response {
  const locale = requestLocale(request);
  if (error instanceof ServiceError) return Response.json({ error: localizedMessage(error.message, locale) }, { status: error.status, headers: noStore });
  const invalidValue = locale === "he" ? "ערך לא תקין" : locale === "de" ? "Ungültiger Wert" : "قيمة غير صالحة / Invalid value";
  if (error instanceof ZodError) return Response.json({ error: error.issues.slice(0, 5).map(issue => `${validationLabel(issue.path, locale)}: ${invalidValue}`).join("; ") }, { status: 400, headers: noStore });
  // Never log raw query parameters, credentials, or financial payloads.
  console.error("Mizan request failed:", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: localizedMessage("The request could not be completed. Please try again.", locale) }, { status: 500, headers: noStore });
}
