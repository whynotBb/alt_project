import { getBrowserTesseractWorkerOptions } from "@/lib/client/tesseract-cdn-public";

/**
 * 브라우저에서 jsDelivr worker/core로 OCR (서버리스·번들 경로 이슈 회피).
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
