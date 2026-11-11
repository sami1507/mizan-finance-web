import { getAuth } from "@/server/auth";
import { checkOrigin, demoCookie, errorResponse, readJson } from "@/server/http";
import { localizedMessage, requestLocale } from "@/server/messages";
import { inspectConfiguration } from "@/server/config";
import { observeMailDelivery } from "@/server/email";
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
    const resetting = request.method === "POST" && url.pathname.endsWith("/request-password-reset");
    if (resetting && inspectConfiguration().email !== "configured") {
      const message = localizedMessage("Password recovery is currently unavailable. Contact the administrator.", requestLocale(request));
      return Response.json({ code: "EMAIL_NOT_CONFIGURED", message, error: message }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    const { result: response, failed } = await observeMailDelivery(async () => (await getAuth()).handler(request));
    if (resetting && failed) {
      const message = localizedMessage("Password recovery is currently unavailable. Contact the administrator.", requestLocale(request));
      return Response.json({ code: "EMAIL_DELIVERY_UNAVAILABLE", message, error: message }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    if (response.ok && request.method === "POST" && /\/(sign-in\/email|sign-up\/email|sign-out)$/.test(url.pathname)) response.headers.append("Set-Cookie", demoCookie("", 0));
    response.headers.set("Cache-Control", "private, no-store");
    // Redirects from reset-token callbacks may carry an empty JSON-typed body.
    // They are not API errors and must retain Location/status unchanged.
    if (response.status >= 400 && response.headers.get("Content-Type")?.includes("application/json")) {
      const data = await response.json();
      if (typeof data.message === "string") data.message = localizedMessage(data.message, requestLocale(request), data.code);
      if (typeof data.error === "string") data.error = localizedMessage(data.error, requestLocale(request), data.code);
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      return Response.json(data, { status: response.status, headers });
    }
    return response;
  } catch (error) { return errorResponse(error, request); }
}
export const GET = handle;
export const POST = handle;
