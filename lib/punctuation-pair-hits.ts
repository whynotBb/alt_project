import type { SpellHit } from "@/types/spell-hit";

type PairFrame = { kind: "pair"; start: number; end: number; open: string; close: string };
type SymFrame = { kind: "sym"; start: number; end: number; quote: "\u0022" | "\u0027" };

type Frame = PairFrame | SymFrame;

const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "（": "）",
  "【": "】",
  "〔": "〕",
  "「": "」",
  "『": "』",
  "《": "》",
  "〈": "〉",
  "\u201C": "\u201D",
  "\u2018": "\u2019",
};

const CLOSE_CHARS = new Set(Object.values(OPEN_TO_CLOSE));

function expectedClose(frame: Frame): string {
  return frame.kind === "pair" ? frame.close : frame.quote;
}

function isSymQuote(ch: string): ch is "\u0022" | "\u0027" {
  return ch === "\u0022" || ch === "\u0027";
}

export function collectPunctuationPairHits(text: string): SpellHit[] {
  if (text.length === 0) return [];

  const hits: SpellHit[] = [];
  const stack: Frame[] = [];

  const pushHit = (start: number, end: number, token: string, replacement: string) => {
    hits.push({ start, end, token, replacement });
  };

  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    const start = i;
    const end = i + ch.length;
    i = end;

    if (isSymQuote(ch)) {
      const top = stack.at(-1);
      if (top?.kind === "sym" && top.quote === ch) {
        stack.pop();
      } else {
        stack.push({ kind: "sym", start, end, quote: ch });
      }
      continue;
    }

    const mappedClose = OPEN_TO_CLOSE[ch];
    if (mappedClose !== undefined) {
      stack.push({ kind: "pair", start, end, open: ch, close: mappedClose });
      continue;
    }

    if (CLOSE_CHARS.has(ch)) {
      if (stack.length === 0) {
        pushHit(start, end, ch, "");
        continue;
      }
      const top = stack.at(-1)!;
      const exp = expectedClose(top);
      if (exp === ch) {
        stack.pop();
      } else {
        pushHit(start, end, ch, exp);
        stack.pop();
      }
      continue;
    }
  }

  for (const frame of stack) {
    const close = expectedClose(frame);
    const openSlice = text.slice(frame.start, frame.end);
    pushHit(frame.start, frame.end, openSlice, `${openSlice}${close}`);
  }

  hits.sort((a, b) => a.start - b.start || a.end - b.end);
  return hits;
}

export function mergeSpellAndPunctuationHits(spelling: SpellHit[], punctuation: SpellHit[]): SpellHit[] {
  return [...spelling, ...punctuation].sort((a, b) => a.start - b.start || a.end - b.end);
}
