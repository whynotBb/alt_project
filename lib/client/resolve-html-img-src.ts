/**
 * ZIP에서 뽑은 HTML/이미지의 상대 경로를 동일한 규칙으로 맞춥니다.
 * - 슬래시 통일, `..`·`.` 처리, 비교용 소문자
 */
export function normalizeZipRelativePath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter((s) => s.length > 0);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/").toLowerCase();
}

function posixDirname(p: string): string {
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  if (i === -1) return "";
  return n.slice(0, i);
}

/**
 * `htmlRelativePath`: 검수 UI의 HtmlAsset.relativePath (예: `아카이브라벨/site/page.html`)
 * `srcAttr`: img의 src
 * 반환: 이미지 항목 `ImageItem.name`과 맞출 수 있는 정규화된 전체 경로 키, 매핑 불가면 null
 */
export function resolveImgSrcToZipRelativeKey(
  htmlRelativePath: string,
  srcAttr: string,
): string | null {
  const raw = srcAttr.trim();
  if (!raw || raw.startsWith("data:") || /^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    return null;
  }
  const noQuery = (raw.split("?")[0] ?? raw).split("#")[0] ?? raw;
  let decoded = noQuery;
  try {
    decoded = decodeURIComponent(noQuery);
  } catch {
    /* keep */
  }
  const htmlNorm = htmlRelativePath.replace(/\\/g, "/").trim();
  if (!htmlNorm) return null;
  const segments = htmlNorm.split("/").filter(Boolean);
  const firstSeg = segments[0] ?? "";
  let resolved: string;
  if (decoded.startsWith("/")) {
    if (!firstSeg) return null;
    resolved = `${firstSeg}/${decoded.replace(/^\/+/, "")}`;
  } else {
    const dir = posixDirname(htmlNorm);
    resolved = dir ? `${dir}/${decoded}` : decoded;
  }
  return normalizeZipRelativePath(resolved);
}
