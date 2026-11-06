import { createDemo } from "@/server/demo";
import { checkOrigin, demoCookie, errorResponse, noStore } from "@/server/http";
import { ServiceError } from "@/server/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// In-process creation limiter; production deployments should also enforce an ingress rate limit.
const requests = new Map<string, { started: number; count: number }>();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const key = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const current = requests.get(key);
    const record = current && Date.now() - current.started < 60000 ? current : { started: Date.now(), count: 0 };
    if (++record.count > 10) throw new ServiceError("Please wait a minute before starting another demo.", 429);
    if (requests.size > 1000) requests.clear();
    requests.set(key, record);
    const demo = await createDemo();
    return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": demoCookie(demo.token) } });
  } catch (error) { return errorResponse(error); }
}
