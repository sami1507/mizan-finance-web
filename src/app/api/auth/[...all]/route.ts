import { getAuth } from "@/server/auth";
import { checkOrigin, demoCookie, errorResponse, readJson } from "@/server/http";
import { bilingual } from "@/server/messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    if (request.method === "POST") {
      checkOrigin(request);
      const body = await readJson(request, 16_384);
      const headers = new Headers(request.headers);
      headers.delete("Content-Length");
      request = new Request(request.url, { method: request.method, headers, body: JSON.stringify(body) });
    }
    if (request.method === "POST" && url.pathname.endsWith("/request-password-reset") && (!process.env.SMTP_URL || !process.env.MAIL_FROM)) {
      const message = bilingual("Password recovery is currently unavailable. Contact the administrator.");
      return Response.json({ code: "EMAIL_NOT_CONFIGURED", message, error: message }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    const response = await (await getAuth()).handler(request);
    if (response.ok && request.method === "POST" && /\/(sign-in\/email|sign-up\/email|sign-out)$/.test(url.pathname)) response.headers.append("Set-Cookie", demoCookie("", 0));
    response.headers.set("Cache-Control", "private, no-store");
    if (!response.ok && response.headers.get("Content-Type")?.includes("application/json")) {
      const data = await response.json();
      if (typeof data.message === "string") data.message = bilingual(data.message, data.code);
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      return Response.json(data, { status: response.status, headers });
    }
    return response;
  } catch (error) { return errorResponse(error); }
}
export const GET = handle;
export const POST = handle;
