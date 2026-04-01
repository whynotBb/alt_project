import { NextResponse } from "next/server";
import { MAX_ZIP_BYTES } from "@/lib/pipeline/run-zip-job";
import { createZipProcessJob } from "@/lib/zip-process-job-store";
import type { ProcessZipResult } from "@/types/process-zip";

type PostAccepted = { ok: true; jobId: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse<ProcessZipResult | PostAccepted>> {
  console.info("[upload-zip] request received (accept + queue)");
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("[upload-zip] formData parse", e);
    return NextResponse.json(
      {
        ok: false,
        message:
          "요청 본문을 읽지 못했습니다. 파일이 너무 크거나 연결이 끊겼을 수 있습니다. 다시 시도해 주세요.",
      },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "ZIP 파일을 선택하세요." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (e) {
    console.error("[upload-zip] arrayBuffer", e);
    return NextResponse.json(
      { ok: false, message: "파일 내용을 읽는 중 오류가 났습니다." },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ ok: false, message: ".zip 파일만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, message: "빈 파일입니다." }, { status: 400 });
  }
  if (buffer.length > MAX_ZIP_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        message: `파일 크기는 ${MAX_ZIP_BYTES / 1024 / 1024}MB 이하여야 합니다.`,
      },
      { status: 400 },
    );
  }

  const jobId = createZipProcessJob(buffer, file.name);
  console.info("[upload-zip] job queued", { jobId, bytes: buffer.length });
  return NextResponse.json({ ok: true, jobId }, { status: 202 });
}
