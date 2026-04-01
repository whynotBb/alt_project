import { NextResponse } from "next/server";
import { collectPunctuationPairHits, mergeSpellAndPunctuationHits } from "@/lib/punctuation-pair-hits";
import { runHanspellDaum } from "@/lib/spell-check-hanspell";
import type { SpellHit } from "@/types/spell-hit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHARS = 8000;

export async function POST(
  request: Request,
): Promise<NextResponse<{ ok: true; hits: SpellHit[] } | { ok: false; message: string }>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문을 읽지 못했습니다." }, { status: 400 });
  }

  const text = typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : "";
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { ok: false, message: `맞춤법 검사는 ${MAX_CHARS}자 이하만 지원합니다.` },
      { status: 400 },
    );
  }

  try {
    const punctHits = collectPunctuationPairHits(text);
    const spellingHits = await runHanspellDaum(text, 20000);
    const hits = mergeSpellAndPunctuationHits(spellingHits, punctHits);
    return NextResponse.json({ ok: true, hits });
  } catch (e) {
    console.error("[spell-check]", e);
    const msg = e instanceof Error ? e.message : "맞춤법 검사 중 오류가 났습니다.";
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}
