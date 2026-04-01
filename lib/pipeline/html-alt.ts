import * as cheerio from "cheerio";

export type AltUpdateResult = {
  html: string;
  updatedCount: number;
};

/**
 * `img` 요소의 `alt`가 비어 있으면 제안 텍스트로 채웁니다.
 * `src` → 로컬 파일 경로 매핑은 호출 측에서 전달합니다.
 */
export function applyAltsToHtml(
  html: string,
  altBySrc: Record<string, string>,
): AltUpdateResult {
  const $ = cheerio.load(html);
  let updatedCount = 0;
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const suggestion = altBySrc[src];
    if (!suggestion) return;
    const current = ($(el).attr("alt") ?? "").trim();
    if (current.length > 0) return;
    $(el).attr("alt", suggestion);
    updatedCount += 1;
  });
  return { html: $.root().html() ?? html, updatedCount };
}
