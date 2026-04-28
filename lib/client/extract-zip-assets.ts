import JSZip from "jszip";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const HTML_EXT = /\.html?$/i;
const CSS_EXT = /\.css$/i;
export const MAX_HTML_ENTRIES = 200;

export type ExtractedZipImage = { relativePath: string; blob: Blob };
export type ExtractedZipHtml = { relativePath: string; content: string };
export type ExtractedZipAsset = { relativePath: string; blob: Blob };

function detectZipContentRootPrefix(allFilePaths: string[]): string {
  if (allFilePaths.length === 0) return "";
  const normalized = allFilePaths.map((p) => p.replace(/\\/g, "/").replace(/^\/+/, ""));
  if (normalized.some((p) => !p.includes("/"))) return "";

  let prefix = "";
  while (true) {
    const underPrefix = normalized.filter((p) => p.startsWith(prefix));
    if (underPrefix.length === 0) return "";

    const seenDirs = new Set<string>();
    const immediateFiles: string[] = [];
    for (const full of underPrefix) {
      const rest = full.slice(prefix.length);
      if (!rest) continue;
      const slash = rest.indexOf("/");
      if (slash < 0) {
        immediateFiles.push(rest);
      } else {
        seenDirs.add(rest.slice(0, slash));
      }
    }

    const hasHtmlAtThisLevel = immediateFiles.some((name) => HTML_EXT.test(name));
    if (hasHtmlAtThisLevel) return prefix;
    if (immediateFiles.length > 0 || seenDirs.size !== 1) return "";

    const [onlyDir] = [...seenDirs];
    prefix = `${prefix}${onlyDir}/`;
  }
}

function trimPrefix(p: string, prefix: string): string {
  if (!prefix) return p;
  return p.startsWith(prefix) ? p.slice(prefix.length) : p;
}

function mimeForImagePath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function mimeForAssetPath(p: string): string {
  if (IMAGE_EXT.test(p)) return mimeForImagePath(p);
  if (CSS_EXT.test(p)) return "text/css";
  return "application/octet-stream";
}

export async function extractZipAssets(file: File): Promise<{
  images: ExtractedZipImage[];
  htmlFiles: ExtractedZipHtml[];
  assets: ExtractedZipAsset[];
}> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const allFilePaths = Object.entries(zip.files)
    .filter(([, entry]) => !entry.dir)
    .map(([entryPath]) => entryPath.replace(/\\/g, "/"));
  const contentRootPrefix = detectZipContentRootPrefix(allFilePaths);

  const images: ExtractedZipImage[] = [];
  const htmlFiles: ExtractedZipHtml[] = [];
  const assets: ExtractedZipAsset[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const posix = trimPrefix(path.replace(/\\/g, "/"), contentRootPrefix);
    if (HTML_EXT.test(posix)) {
      if (htmlFiles.length >= MAX_HTML_ENTRIES) continue;
      const content = await entry.async("string");
      htmlFiles.push({ relativePath: posix, content });
      continue;
    }

    const ab = await entry.async("arraybuffer");
    const blob = new Blob([ab], { type: mimeForAssetPath(posix) });
    assets.push({ relativePath: posix, blob });
    if (IMAGE_EXT.test(posix)) {
      images.push({ relativePath: posix, blob });
    }
  }

  images.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  htmlFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { images, htmlFiles, assets };
}

export function isZipFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return file.type === "application/zip" || file.type === "application/x-zip-compressed" || n.endsWith(".zip");
}

/** 브라우저에서 단일 선택해 올린 HTML 파일(확장자·MIME 기준) */
export function isHtmlUploadFile(file: File): boolean {
  return file.type === "text/html" || HTML_EXT.test(file.name);
}

export function zipArchiveLabel(fileName: string): string {
  return fileName.replace(/\.zip$/i, "") || "archive";
}
