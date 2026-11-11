import { isReady } from "@/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("check") !== "ready") return Response.json({ status: "alive" }, { headers });
  const ready = await isReady();
  return Response.json({ status: ready ? "ready" : "unavailable" }, { status: ready ? 200 : 503, headers });
}
