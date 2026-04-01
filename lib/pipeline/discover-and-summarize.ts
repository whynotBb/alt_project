import { readdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import type { ZipLayoutReport } from "@/types/zip-layout";

const HTML_EXT = /\.html?$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

export async function listAllFiles(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else {
        out.push(p);
      }
    }
  }

  await walk(root);
  return out;
}

/**
 * 압축 루트에 파일이 없고 하위에 단일 폴더만 있으면 그 폴더를 사이트 루트로 본다.
 * - index.html + images/ 가 ZIP 루트에 바로 있는 경우 → extractRoot 그대로
 * - project/index.html 만 있는 경우 → project/ 가 콘텐츠 루트
 */
export function detectContentRoot(extractRoot: string, absoluteFilePaths: string[]): string {
  const rels = absoluteFilePaths
    .map((f) => path.relative(extractRoot, f))
    .filter((r) => r.length > 0 && !r.startsWith(".."));
  const directlyUnderExtract = rels.filter((r) => !r.includes(path.sep));
  if (directlyUnderExtract.length > 0) {
    return extractRoot;
  }
  const firstSegs = new Set(
    rels.map((r) => r.split(path.sep)[0]).filter((s): s is string => Boolean(s)),
  );
  if (firstSegs.size === 1) {
    return path.join(extractRoot, [...firstSegs][0]);
  }
  return extractRoot;
}

/** extractRoot 기준 posix 상대 경로 (표시용) */
function posixRelative(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/") || ".";
}

function isPathInsideRoot(rootDir: string, candidatePath: string): boolean {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  if (candidate === root) return true;
  const prefix = root + path.sep;
  return candidate.startsWith(prefix);
}

export function resolveLocalImgToAbsolute(
  htmlPath: string,
  srcRaw: string,
  contentRootAbs: string,
): string | null {
  const trimmed = srcRaw.trim();
  if (
    !trimmed ||
    trimmed.startsWith("data:") ||
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("//")
  ) {
    return null;
  }
  const noQuery = (trimmed.split("?")[0] ?? trimmed).trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(noQuery);
  } catch {
    decoded = noQuery;
  }

  let absolute: string;
  if (decoded.startsWith("/")) {
    absolute = path.normalize(path.join(contentRootAbs, decoded.replace(/^\/+/, "")));
  } else {
    absolute = path.normalize(path.join(path.dirname(htmlPath), decoded));
  }

  if (!isPathInsideRoot(contentRootAbs, absolute)) {
    return null;
  }
  return absolute;
}

export async function buildZipLayoutReport(
  extractRootAbs: string,
  absoluteFilePaths: string[],
  maxHtmlFilesForSrcCheck: number,
): Promise<ZipLayoutReport> {
  const contentRootAbs = detectContentRoot(extractRootAbs, absoluteFilePaths);
  const normalizedSet = new Set(absoluteFilePaths.map((f) => path.normalize(f)));

  let htmlNextToContentRoot = 0;
  let htmlInSubfolders = 0;
  let imagesNextToContentRoot = 0;
  let imagesUnderImagesFolder = 0;
  let imagesInOtherFolders = 0;

  for (const f of absoluteFilePaths) {
    const relPosix = posixRelative(contentRootAbs, f);
    if (relPosix.startsWith("..")) continue;

    if (HTML_EXT.test(f)) {
      if (!relPosix.includes("/")) htmlNextToContentRoot += 1;
      else htmlInSubfolders += 1;
      continue;
    }

    if (IMAGE_EXT.test(f)) {
      const parts = relPosix.split("/").filter(Boolean);
      if (parts.length <= 1) {
        imagesNextToContentRoot += 1;
      } else if (parts[0]?.toLowerCase() === "images") {
        imagesUnderImagesFolder += 1;
      } else {
        imagesInOtherFolders += 1;
      }
    }
  }

  const htmlPaths = absoluteFilePaths.filter((p) => HTML_EXT.test(p)).slice(0, maxHtmlFilesForSrcCheck);
  let localImgRefs = 0;
  let localImgResolved = 0;
  let localImgMissing = 0;

  for (const htmlPath of htmlPaths) {
    const html = await readFile(htmlPath, "utf8");
    const $ = cheerio.load(html);
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      const target = resolveLocalImgToAbsolute(htmlPath, src, contentRootAbs);
      if (target === null) return;
      localImgRefs += 1;
      if (normalizedSet.has(path.normalize(target))) {
        localImgResolved += 1;
      } else {
        localImgMissing += 1;
      }
    });
  }

  return {
    contentRootRelativePosix: posixRelative(extractRootAbs, contentRootAbs),
    htmlNextToContentRoot,
    htmlInSubfolders,
    imagesNextToContentRoot,
    imagesUnderImagesFolder,
    imagesInOtherFolders,
    localImgRefs,
    localImgResolved,
    localImgMissing,
  };
}

export type HtmlAltSummary = {
  htmlFilesScanned: number;
  imageTags: number;
  imagesMissingAlt: number;
};

export async function summarizeHtmlAltStats(
  absolutePaths: string[],
  maxHtmlFiles: number,
): Promise<HtmlAltSummary> {
  const htmlPaths = absolutePaths.filter((p) => HTML_EXT.test(p)).slice(0, maxHtmlFiles);
  let imageTags = 0;
  let imagesMissingAlt = 0;

  for (const file of htmlPaths) {
    const html = await readFile(file, "utf8");
    const $ = cheerio.load(html);
    $("img").each((_, el) => {
      imageTags += 1;
      const alt = $(el).attr("alt");
      if (alt === undefined || alt.trim().length === 0) {
        imagesMissingAlt += 1;
      }
    });
  }

  return {
    htmlFilesScanned: htmlPaths.length,
    imageTags,
    imagesMissingAlt,
  };
}
