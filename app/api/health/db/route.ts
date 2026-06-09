import { NextResponse } from "next/server";
import { getWords } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getWords("health-check");
  const totalVotes = payload.words.reduce((sum, word) => sum + word.totalVotes, 0);

  return NextResponse.json({
    ok: true,
    database: process.env.DATABASE_URL ? "postgres" : "local-sqlite",
    wordCount: payload.words.length,
    totalVotes,
    todayWordId: payload.todayWordId,
  });
}
