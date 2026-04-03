import { getBrowserTesseractWorkerOptions } from "@/lib/client/tesseract-cdn-public";

/**
 * 브라우저에서 `public/vendor/tesseract` 정적 자원으로 OCR (동일 출처 Worker).
 */
export async function ocrRasterImageBlobWithTesseract(blob: Blob): Promise<string> {
	const { createWorker } = await import("tesseract.js");
	const worker = await createWorker("kor+eng", undefined, getBrowserTesseractWorkerOptions());
	try {
		const { data } = await worker.recognize(blob);
		return data.text.trim();
	} finally {
		await worker.terminate();
	}
}
