import { createWorker } from "tesseract.js";
import { getTesseractWorkerOptions } from "@/lib/pipeline/tesseract-worker-options";

/**
 * 로컬 Tesseract로 이미지에서 텍스트를 추출합니다 (외부 API 없음).
 * 대용량·동시 요청 시 워커 풀·큐 도입을 검토하세요.
 */
export async function ocrImageFile(imagePath: string): Promise<string> {
	const worker = await createWorker("kor+eng", undefined, getTesseractWorkerOptions());
	try {
		const { data } = await worker.recognize(imagePath);
		return data.text.trim();
	} finally {
		await worker.terminate();
	}
}

/** 워커 1회 생성 후 순차 인식 (파일마다 워커 생성보다 훨씬 빠름). */
export async function ocrImagePathsToMap(imagePaths: string[]): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	if (imagePaths.length === 0) return out;
	const worker = await createWorker("kor+eng", undefined, getTesseractWorkerOptions());
	try {
		for (const p of imagePaths) {
			const { data } = await worker.recognize(p);
			out.set(p, data.text.trim());
		}
	} finally {
		await worker.terminate();
	}
	return out;
}

/** 업로드 버퍼(브라우저 → API)에서 바로 인식합니다. */
export async function ocrImageBuffer(buffer: Buffer): Promise<string> {
	const worker = await createWorker("kor+eng", undefined, getTesseractWorkerOptions());
	try {
		const { data } = await worker.recognize(buffer);
		return data.text.trim();
	} finally {
		await worker.terminate();
	}
}
