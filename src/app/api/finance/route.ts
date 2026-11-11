import { identity, checkOrigin, readJson, errorResponse, noStore, demoCookie } from "@/server/http";
import { getSnapshot, mutateFinance, deleteUserData } from "@/server/finance-service";
import { ServiceError } from "@/server/validation";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const user = await identity(request); return Response.json(await getSnapshot(user.id), { headers: noStore }); }
  catch (error) { return errorResponse(error, request); }
}
export async function POST(request: Request) {
  try { checkOrigin(request); const user = await identity(request); checkWorkspace(request, user.id); return Response.json(await mutateFinance(user.id, await readJson(request), request.headers.get("Idempotency-Key") ?? undefined), { headers: noStore }); }
  catch (error) { return errorResponse(error, request); }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await identity(request);
    checkWorkspace(request, user.id);
    const data = z.object({ confirmation: z.string() }).parse(await readJson(request));
    if (data.confirmation !== "DELETE") throw new ServiceError("Type DELETE to confirm permanent deletion.");
    await deleteUserData(user.id);
    return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": demoCookie("", 0) } });
  } catch (error) { return errorResponse(error, request); }
}
function checkWorkspace(request: Request, userId: string) {
  const expected = request.headers.get("X-Mizan-Workspace");
  if (expected && expected !== userId) throw new ServiceError("The signed-in account changed. Reload the page before making changes.", 409);
}
