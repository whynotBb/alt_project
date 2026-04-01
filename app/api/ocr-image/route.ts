import { NextResponse } from "next/server";
import sharp from "sharp";
import { ocrImageBuffer } from "@/lib/pipeline/ocr-tesseract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse<{ text: string } | { message: string }>> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "요청 본문을 읽지 못했습니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "이미지 파일이 필요합니다." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ message: "빈 파일입니다." }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ message: "파일이 너무 큽니다." }, { status: 400 });
  }

  try {
    const preprocessed = await sharp(buf)
      .rotate()
      .grayscale()
      .normalize()
      .linear(1.12, -(128 * 0.12))
      .png()
      .toBuffer();
    const text = await ocrImageBuffer(preprocessed);
    return NextResponse.json({ text });
  } catch (e) {
    console.error("[ocr-image]", e);
    const msg = e instanceof Error ? e.message : "OCR 처리 중 오류가 났습니다.";
    return NextResponse.json({ message: msg }, { status: 502 });
  }
}
