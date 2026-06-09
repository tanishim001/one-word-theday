import { NextRequest, NextResponse } from "next/server";
import { getWords } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const payload = await getWords(clientId);

  return NextResponse.json(payload);
}
