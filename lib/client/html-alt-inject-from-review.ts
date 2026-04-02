/**
 * 검수 UI의 이미지 항목을 기준으로 HTML 마크업에 alt를 채웁니다.
 * - 승인(reviewed)되었고 대상 제외가 아닌 항목만 반영합니다.
 * - 이미 alt가 있는 img는 건드리지 않습니다.
 * - HTML이 여러 개일 때: 각 HTML의 경로를 기준으로 `src`를 ZIP 내 실경로로 풀어,
 *   그 경로와 동일한 이미지 항목에만 alt를 넣습니다 (파일명만으로 다른 폴더 이미지에 주입되지 않음).
 */

import { normalizeZipRelativePath, resolveImgSrcToZipRelativeKey } from "@/lib/client/resolve-html-img-src";

export type ReviewItemForAlt = {
  name: string;
  finalAlt: string;
  reviewed: boolean;
  excludedFromTarget: boolean;
};

function pathKeysForItem(name: string): string[] {
  const norm = normalizeZipRelativePath(name);
  const out = new Set<string>([norm]);
  const parts = norm.split("/").filter(Boolean);
  if (parts.length >= 2) out.add(parts.slice(1).join("/"));
  const base = parts.at(-1);
  if (base) out.add(base);
  return [...out];
}

/** 전체 경로 → alt (정확 매칭용) */
function buildAltByFullPath(items: ReviewItemForAlt[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items) {
    if (it.excludedFromTarget || !it.reviewed) continue;
    const text = it.finalAlt.trim();
    if (!text) continue;
    m.set(normalizeZipRelativePath(it.name), text);
  }
  return m;
}

/** 파일명이 프로젝트 전체에서 유일할 때만 쓰는 보조 매칭 */
function buildBasenameUniqueLookup(items: ReviewItemForAlt[]): Map<string, string> {
  const count = new Map<string, number>();
  const lastText = new Map<string, string>();
  for (const it of items) {
    if (it.excludedFromTarget || !it.reviewed) continue;
    const text = it.finalAlt.trim();
    if (!text) continue;
    const base = normalizeZipRelativePath(it.name).split("/").pop() ?? "";
    if (!base) continue;
    count.set(base, (count.get(base) ?? 0) + 1);
    lastText.set(base, text);
  }
  const m = new Map<string, string>();
  for (const [base, n] of count) {
    if (n === 1 && lastText.has(base)) m.set(base, lastText.get(base)!);
  }
  return m;
}

function buildAltLookupLegacy(items: ReviewItemForAlt[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items) {
    if (it.excludedFromTarget || !it.reviewed) continue;
    const text = it.finalAlt.trim();
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

export function injectReviewedAltsIntoHtmlMarkup(
  html: string,
  items: ReviewItemForAlt[],
  htmlRelativePath: string,
): string {
  const byFullPath = buildAltByFullPath(items);
  const byBasename = buildBasenameUniqueLookup(items);
  const legacy = buildAltLookupLegacy(items);
  if (byFullPath.size === 0 && byBasename.size === 0 && legacy.size === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc.documentElement) return html;

  for (const img of doc.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") ?? "";
    let suggestion: string | undefined;
    const resolvedKey = resolveImgSrcToZipRelativeKey(htmlRelativePath, src);
    if (resolvedKey) {
      suggestion = byFullPath.get(resolvedKey);
      if (!suggestion) {
        const bn = resolvedKey.split("/").pop() ?? "";
        if (bn) suggestion = byBasename.get(bn);
      }
    }
    if (!suggestion) {
      for (const k of srcKeys(src)) {
        if (legacy.has(k)) {
          suggestion = legacy.get(k);
          break;
        }
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
