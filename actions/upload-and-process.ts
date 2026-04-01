"use server";

import { MAX_ZIP_BYTES, runZipProcessing } from "@/lib/pipeline/run-zip-job";
import type { ProcessZipResult } from "@/types/process-zip";

export type { ProcessZipResult } from "@/types/process-zip";

/** 폼/서버 액션용 — 대용량·multipart 이슈 시 API 라우트를 사용하세요. */
export async function processUploadedZip(formData: FormData): Promise<ProcessZipResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "ZIP 파일을 선택하세요." };
  }
  if (file.size > MAX_ZIP_BYTES) {
    return {
      ok: false,
      message: `파일 크기는 ${MAX_ZIP_BYTES / 1024 / 1024}MB 이하여야 합니다.`,
    };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return runZipProcessing(buffer, file.name);
}
