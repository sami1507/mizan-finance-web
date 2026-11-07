import { checkOrigin, demoCookie, errorResponse, noStore } from "@/server/http";
export async function POST(request: Request) {
  try { checkOrigin(request); return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": demoCookie("", 0) } }); }
  catch (error) { return errorResponse(error, request); }
}
