/**
 * 검수 UI의 이미지 항목을 기준으로 HTML 마크업에 alt를 채웁니다.
 * - 승인(reviewed)되었고 대상 제외가 아닌 항목만 반영합니다.
 * - 이미 alt가 있는 img는 건드리지 않습니다.
 */

export type ReviewItemForAlt = {
  name: string;
  extractedText: string;
  reviewed: boolean;
  excludedFromTarget: boolean;
};

function pathKeysForItem(name: string): string[] {
  const lower = name.replace(/\\/g, "/").toLowerCase();
  const out = new Set<string>([lower]);
  const parts = lower.split("/").filter(Boolean);
  if (parts.length >= 2) out.add(parts.slice(1).join("/"));
  const base = parts.at(-1);
  if (base) out.add(base);
  return [...out];
}

function buildAltLookup(items: ReviewItemForAlt[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items) {
    if (it.excludedFromTarget || !it.reviewed) continue;
    const text = it.extractedText.trim();
    if (!text) continue;
    for (const k of pathKeysForItem(it.name)) {
      if (!m.has(k)) m.set(k, text);
    }
  }
  return m;
}

function srcKeys(srcAttr: string): string[] {
  const raw = srcAttr.trim();
  if (!raw) return [];
  const noHash = raw.split("#")[0] ?? raw;
  const noQuery = noHash.split("?")[0] ?? noHash;
  let decoded = noQuery;
  try {
    decoded = decodeURIComponent(noQuery);
  } catch {
    /* keep */
  }
  const norm = decoded.replace(/\\/g, "/").replace(/^(\.\/)+/, "").toLowerCase();
  const out = new Set<string>([norm]);
  const segments = norm.split("/").filter(Boolean);
  if (segments.length) out.add(segments.join("/"));
  const base = segments.at(-1);
  if (base) out.add(base);
  return [...out];
}

export function injectReviewedAltsIntoHtmlMarkup(html: string, items: ReviewItemForAlt[]): string {
  const lookup = buildAltLookup(items);
  if (lookup.size === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc.documentElement) return html;

  for (const img of doc.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") ?? "";
    let suggestion: string | undefined;
    for (const k of srcKeys(src)) {
      if (lookup.has(k)) {
        suggestion = lookup.get(k);
        break;
      }
    }
    if (!suggestion) continue;
    const cur = (img.getAttribute("alt") ?? "").trim();
    if (cur.length > 0) continue;
    img.setAttribute("alt", suggestion);
  }

  const doctypeMatch = html.match(/^<!DOCTYPE[^>]*>\s*/i);
  const doctype = doctypeMatch ? doctypeMatch[0] : "";
  return doctype + doc.documentElement.outerHTML;
}
