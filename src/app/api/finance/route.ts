import { identity, checkOrigin, readJson, errorResponse, noStore, demoCookie } from "@/server/http";
import { getSnapshot, mutateFinance, deleteUserData } from "@/server/finance-service";
import { ServiceError } from "@/server/validation";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const user = await identity(request); return Response.json(await getSnapshot(user.id), { headers: noStore }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { checkOrigin(request); const user = await identity(request); return Response.json(await mutateFinance(user.id, await readJson(request)), { headers: noStore }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await identity(request);
    const data = z.object({ confirmation: z.string() }).parse(await readJson(request));
    if (data.confirmation !== "DELETE") throw new ServiceError("Type DELETE to confirm permanent deletion.");
    await deleteUserData(user.id);
    return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": demoCookie("", 0) } });
  } catch (error) { return errorResponse(error); }
}
