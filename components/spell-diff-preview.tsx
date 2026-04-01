"use client";

import type { SpellHit } from "@/types/spell-hit";

export function SpellDiffPreview({ text, hits }: { text: string; hits: SpellHit[] }) {
  if (hits.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">맞춤법 검사 결과 교정이 필요한 구간이 없습니다.</p>
    );
  }

  const sorted = [...hits].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const h of sorted) {
    if (h.start < cursor) continue;
    if (h.start > cursor) {
      parts.push(<span key={key++}>{text.slice(cursor, h.start)}</span>);
    }
    parts.push(
      <del key={key++} className="text-foreground/80 decoration-red-600/90">
        {text.slice(h.start, h.end)}
      </del>,
    );
    parts.push(
      <span key={key++} className="font-medium text-red-600 dark:text-red-400">
        {h.replacement}
      </span>,
    );
    cursor = h.end;
  }
  if (cursor < text.length) {
    parts.push(<span key={key++}>{text.slice(cursor)}</span>);
  }

  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{parts}</div>;
}
