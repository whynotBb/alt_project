import { normalizeZipRelativePath, resolveImgSrcToZipRelativeKey } from "@/lib/client/resolve-html-img-src";
import { normalizeImportedAltText } from "@/lib/client/normalize-alt-text";

export type HtmlAssetLike = {
  relativePath: string;
  content: string;
};

/**
 * HTML 자산들에서 `imageName`(ZIP 기준 상대 경로)과 src가 맞는 img의 alt를 찾습니다.
 * 첫 번째로 매칭되고 alt가 비어 있지 않은 값을 반환합니다.
 */
export function getExistingAltFromHtmlForImage(
  imageName: string,
  htmlAssets: HtmlAssetLike[],
): string {
  const target = normalizeZipRelativePath(imageName);
  if (!target || htmlAssets.length === 0) return "";

  const sorted = [...htmlAssets].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  for (const html of sorted) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html.content, "text/html");
    if (!doc.documentElement) continue;

    for (const img of doc.querySelectorAll("img[src]")) {
      const src = (img.getAttribute("src") ?? "").trim();
      if (!src) continue;
      const resolved = resolveImgSrcToZipRelativeKey(html.relativePath, src);
      if (resolved !== target) continue;
      const alt = img.getAttribute("alt");
      if (alt === null) continue;
      const normalizedAlt = normalizeImportedAltText(alt);
      if (normalizedAlt.trim().length > 0) return normalizedAlt;
    }
  }
  return "";
}
