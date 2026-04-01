import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { auth } from "@/auth";
import { recordAuditEvent } from "@/actions/audit";
import { extractZipBufferToDir } from "@/lib/pipeline/extract-zip";
import { removeTempDir } from "@/lib/pipeline/cleanup";
import {
  buildZipLayoutReport,
  detectContentRoot,
  listAllFiles,
  summarizeHtmlAltStats,
} from "@/lib/pipeline/discover-and-summarize";
import { runOcrAndInjectAlts } from "@/lib/pipeline/ocr-alt-inject";
import { zipFolderToBuffer } from "@/lib/pipeline/zip-pack";
import { storeZipDownload } from "@/lib/upload-download-cache";
import type { ProcessZipResult } from "@/types/process-zip";

export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
export type { ProcessZipResult } from "@/types/process-zip";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const HTML_EXT = /\.html?$/i;
const MAX_HTML_SCAN = 40;
const MAX_OCR_IMAGES = Number(process.env.MAX_OCR_IMAGES ?? "20") || 20;

export async function runZipProcessing(buffer: Buffer, fileName: string): Promise<ProcessZipResult> {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".zip")) {
    return { ok: false, message: ".zip 파일만 업로드할 수 있습니다." };
  }
  if (buffer.length === 0) {
    return { ok: false, message: "빈 파일입니다." };
  }
  if (buffer.length > MAX_ZIP_BYTES) {
    return {
      ok: false,
      message: `파일 크기는 ${MAX_ZIP_BYTES / 1024 / 1024}MB 이하여야 합니다.`,
    };
  }

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(path.join(os.tmpdir(), "alt-audit-"));
    await extractZipBufferToDir(buffer, workDir);

    let files = await listAllFiles(workDir);
    const htmlFiles = files.filter((f) => HTML_EXT.test(f)).length;
    const imageFiles = files.filter((f) => IMAGE_EXT.test(f)).length;

    const contentRoot = detectContentRoot(workDir, files);
    const ocrInject = await runOcrAndInjectAlts(contentRoot, files, MAX_OCR_IMAGES);

    files = await listAllFiles(workDir);
    const [altStats, layout] = await Promise.all([
      summarizeHtmlAltStats(files, MAX_HTML_SCAN),
      buildZipLayoutReport(workDir, files, MAX_HTML_SCAN),
    ]);

    let downloadToken: string | null = null;
    try {
      const outZip = await zipFolderToBuffer(workDir, files);
      downloadToken = storeZipDownload(outZip);
    } catch (err) {
      console.error("[upload] 결과 ZIP 생성 실패", err);
    }

    try {
      await recordAuditEvent("zip_processed", files.length);
    } catch (err) {
      console.error("[upload] audit log 실패", err);
    }

    const session = await auth();
    const userHint = session?.user?.email ? ` (${session.user.email})` : "";
    return {
      ok: true,
      message: `OCR로 alt를 주입하고 요약을 만들었습니다${userHint}. 아래에서 통계를 확인하고, 필요 시 수정된 ZIP을 내려받을 수 있습니다.`,
      stats: {
        totalFiles: files.length,
        htmlFiles,
        imageFiles,
        htmlFilesScanned: altStats.htmlFilesScanned,
        imageTags: altStats.imageTags,
        imagesMissingAlt: altStats.imagesMissingAlt,
        layout,
        ocrImagesProcessed: ocrInject.ocrImagesProcessed,
        ocrImagesSkippedCap: ocrInject.ocrImagesSkippedCap,
        ocrTextsEmpty: ocrInject.ocrTextsEmpty,
        altsInjected: ocrInject.altsInjected,
        htmlFilesUpdated: ocrInject.htmlFilesUpdated,
        downloadToken,
      },
    };
  } catch (e) {
    console.error("[upload] runZipProcessing", e);
    const msg = e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.";
    return { ok: false, message: msg };
  } finally {
    if (workDir) {
      await removeTempDir(workDir).catch(() => undefined);
    }
  }
}
