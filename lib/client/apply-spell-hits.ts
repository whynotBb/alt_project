import type { SpellHit } from "@/types/spell-hit";

/** 겹치지 않는 SpellHit 구간을 왼쪽부터 순서대로 치환합니다. */
export function applySpellHits(text: string, hits: SpellHit[]): string {
  if (hits.length === 0) return text;
  const sorted = [...hits].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const h of sorted) {
    if (h.start < cursor || h.end > text.length) continue;
    if (text.slice(h.start, h.end) !== h.token) continue;
    out += text.slice(cursor, h.start);
    out += h.replacement;
    cursor = h.end;
  }
  out += text.slice(cursor);
  return out;
}
