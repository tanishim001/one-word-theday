import { NextRequest, NextResponse } from "next/server";
import { saveVote } from "../../../lib/db";
import type { Answer } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    wordId?: string;
    clientId?: string;
    answer?: Answer;
  };

  if (!body.wordId || !body.clientId || !isAnswer(body.answer)) {
    return NextResponse.json({ message: "Invalid vote payload." }, { status: 400 });
  }

  const payload = await saveVote({
    wordId: body.wordId,
    clientId: body.clientId,
    answer: body.answer,
  });

  return NextResponse.json(payload);
}

function isAnswer(answer: unknown): answer is Answer {
  return answer === "known" || answer === "unknown";
}
