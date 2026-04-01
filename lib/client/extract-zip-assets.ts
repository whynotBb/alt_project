import JSZip from "jszip";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const HTML_EXT = /\.html?$/i;
const MAX_HTML_ENTRIES = 200;

export type ExtractedZipImage = { relativePath: string; blob: Blob };
export type ExtractedZipHtml = { relativePath: string; content: string };

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

export async function extractZipAssets(file: File): Promise<{
  images: ExtractedZipImage[];
  htmlFiles: ExtractedZipHtml[];
}> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const images: ExtractedZipImage[] = [];
  const htmlFiles: ExtractedZipHtml[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const posix = path.replace(/\\/g, "/");
    if (HTML_EXT.test(posix)) {
      if (htmlFiles.length >= MAX_HTML_ENTRIES) continue;
      const content = await entry.async("string");
      htmlFiles.push({ relativePath: posix, content });
    } else if (IMAGE_EXT.test(posix)) {
      const ab = await entry.async("arraybuffer");
      images.push({
        relativePath: posix,
        blob: new Blob([ab], { type: mimeForImagePath(posix) }),
      });
    }
  }

  images.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  htmlFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { images, htmlFiles };
}

export function isZipFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return file.type === "application/zip" || file.type === "application/x-zip-compressed" || n.endsWith(".zip");
}

export function zipArchiveLabel(fileName: string): string {
  return fileName.replace(/\.zip$/i, "") || "archive";
}
