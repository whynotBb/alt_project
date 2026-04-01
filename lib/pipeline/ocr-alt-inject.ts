import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { resolveLocalImgToAbsolute } from "@/lib/pipeline/discover-and-summarize";
import { ocrImagePathsToMap } from "@/lib/pipeline/ocr-tesseract";

const HTML_EXT = /\.html?$/i;
/** SVG는 래스터 OCR에 부적합해 제외 */
const IMAGE_OCR_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
const MAX_ALT_CHARS = 420;

function posixRelFromRoot(contentRootAbs: string, absolutePath: string): string {
  return path.relative(contentRootAbs, absolutePath).split(path.sep).join("/");
}

function normRelKey(contentRootAbs: string, absolutePath: string): string {
  return posixRelFromRoot(contentRootAbs, absolutePath).replace(/\\/g, "/").toLowerCase();
}

export type OcrAltInjectSummary = {
  ocrImagesProcessed: number;
  ocrImagesSkippedCap: number;
  ocrTextsEmpty: number;
  altsInjected: number;
  htmlFilesUpdated: number;
};

/**
 * 이미지에 대해 OCR을 수행한 뒤, 빈 alt인 로컬 img에만 텍스트를 주입하고 HTML을 덮어쓴다.
 */
export async function runOcrAndInjectAlts(
  contentRootAbs: string,
  allAbsoluteFiles: string[],
  maxOcrImages: number,
): Promise<OcrAltInjectSummary> {
  const allRasterImages = allAbsoluteFiles.filter((f) => IMAGE_OCR_EXT.test(f));
  const ocrTargets = allRasterImages.slice(0, maxOcrImages);
  const skippedCap = Math.max(0, allRasterImages.length - ocrTargets.length);

  const ocrMap = await ocrImagePathsToMap(ocrTargets);
  const altByRelKey = new Map<string, string>();
  let ocrTextsEmpty = 0;
  for (const imgAbs of ocrTargets) {
    const text = (ocrMap.get(imgAbs) ?? "").trim();
    if (!text) ocrTextsEmpty += 1;
    else altByRelKey.set(normRelKey(contentRootAbs, imgAbs), text.slice(0, MAX_ALT_CHARS));
  }

  const htmlPaths = allAbsoluteFiles.filter((f) => HTML_EXT.test(f));
  let altsInjected = 0;
  let htmlFilesUpdated = 0;

  for (const htmlPath of htmlPaths) {
    const raw = await readFile(htmlPath, "utf8");
    const $ = cheerio.load(raw);
    let touched = false;
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      const abs = resolveLocalImgToAbsolute(htmlPath, src, contentRootAbs);
      if (!abs) return;
      if (!IMAGE_OCR_EXT.test(abs)) return;
      const key = normRelKey(contentRootAbs, abs);
      const suggestion = altByRelKey.get(key);
      if (!suggestion) return;
      const current = ($(el).attr("alt") ?? "").trim();
      if (current.length > 0) return;
      $(el).attr("alt", suggestion);
      altsInjected += 1;
      touched = true;
    });
    if (touched) {
      const next = $.root().html() ?? raw;
      await writeFile(htmlPath, next, "utf8");
      htmlFilesUpdated += 1;
    }
  }

  return {
    ocrImagesProcessed: ocrTargets.length,
    ocrImagesSkippedCap: skippedCap,
    ocrTextsEmpty,
    altsInjected,
    htmlFilesUpdated,
  };
}
