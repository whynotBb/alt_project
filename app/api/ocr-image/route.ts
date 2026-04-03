import { NextResponse } from "next/server";
import sharp from "sharp";
import { ocrImageBufferGoogleVision } from "@/lib/pipeline/ocr-google-vision";
import { ocrImageBuffer } from "@/lib/pipeline/ocr-tesseract";
import { ocrImageBufferOcrSpace } from "@/lib/pipeline/ocr-ocrspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

function parseEngine(raw: FormDataEntryValue | null): "tesseract" | "google-vision" | "ocr-space" {
	if (raw === "google-vision") return "google-vision";
	if (raw === "tesseract") return "tesseract";
	if (raw === "ocr-space") return "ocr-space";
	return "google-vision";
}

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

	const engine = parseEngine(formData.get("engine"));

	const buf = Buffer.from(await file.arrayBuffer());
	if (buf.length === 0) {
		return NextResponse.json({ message: "빈 파일입니다." }, { status: 400 });
	}
	if (buf.length > MAX_BYTES) {
		return NextResponse.json({ message: "파일이 너무 큽니다." }, { status: 400 });
	}

	try {
		if (engine === "google-vision") {
			const prepared = await sharp(buf).rotate().png().toBuffer();
			const text = await ocrImageBufferGoogleVision(prepared);
			return NextResponse.json({ text });
		}

		if (engine === "ocr-space") {
			// Base64 업로드는 `filetype`이 정확하지 않으면 실패율이 올라가서,
			// OCR.space쪽은 rotate + png로 통일해서 전송합니다.
			const prepared = await sharp(buf).rotate().png().toBuffer();
			const text = await ocrImageBufferOcrSpace(prepared, { uploadContentType: "image/png" });
			return NextResponse.json({ text });
		}

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
		const status = typeof msg === "string" && (msg.includes("GOOGLE_CLOUD_VISION_API_KEY") || msg.includes("OCR_SPACE_API_KEY")) ? 503 : 502;
		return NextResponse.json({ message: msg }, { status });
	}
}
