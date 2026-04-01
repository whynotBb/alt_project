import { createRequire } from "node:module";
import path from "node:path";
import type { SpellHit } from "@/types/spell-hit";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { spellCheckByDAUM } = require("hanspell") as {
  spellCheckByDAUM: (
    sentence: string,
    timeout: number,
    check: (typos: Array<{ token: string; suggestions: string[] }> | undefined) => void,
    end: (() => void) | null,
    error: (err: unknown) => void,
  ) => void;
};

function alignTyposToText(text: string, raw: { token: string; suggestions: string[] }[]): SpellHit[] {
  let from = 0;
  const hits: SpellHit[] = [];
  for (const t of raw) {
    if (!t.token) continue;
    const rep = t.suggestions[0];
    if (rep === undefined || rep === "") continue;
    const idx = text.indexOf(t.token, from);
    if (idx === -1) continue;
    hits.push({
      start: idx,
      end: idx + t.token.length,
      token: t.token,
      replacement: rep,
    });
    from = idx + t.token.length;
  }
  return hits;
}

/** hanspell spellCheckByDAUM — Daum API 사용(네트워크 필요). */
export function runHanspellDaum(text: string, timeoutMs = 15000): Promise<SpellHit[]> {
  if (text.length === 0) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const raw: { token: string; suggestions: string[] }[] = [];

    try {
      spellCheckByDAUM(
        text,
        timeoutMs,
        (typos: Array<{ token: string; suggestions: string[] }> | undefined) => {
          if (typos?.length) {
            for (const t of typos) {
              raw.push({ token: t.token, suggestions: t.suggestions });
            }
          }
        },
        () => {
          resolve(alignTyposToText(text, raw));
        },
        (err: unknown) => {
          reject(err instanceof Error ? err : new Error(String(err ?? "맞춤법 검사 실패")));
        },
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
