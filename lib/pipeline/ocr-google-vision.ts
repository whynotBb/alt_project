const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

type VisionAnnotateResponse = {
	responses?: Array<{
		fullTextAnnotation?: { text?: string };
		textAnnotations?: Array<{ description?: string }>;
		error?: { message?: string; code?: number };
	}>;
	error?: { message?: string; code?: number };
};

/**
 * Cloud Vision API (DOCUMENT_TEXT_DETECTION)로 텍스트를 추출합니다.
 * `GOOGLE_CLOUD_VISION_API_KEY` 환경 변수가 필요합니다.
 */
export async function ocrImageBufferGoogleVision(imageBuffer: Buffer): Promise<string> {
	const key = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim();
	if (!key) {
		throw new Error("GOOGLE_CLOUD_VISION_API_KEY가 설정되어 있지 않습니다.");
	}

	const url = `${VISION_URL}?key=${encodeURIComponent(key)}`;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			requests: [
				{
					image: { content: imageBuffer.toString("base64") },
					features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
				},
			],
		}),
	});

	const data = (await res.json()) as VisionAnnotateResponse;

	if (!res.ok) {
		const msg = data.error?.message ?? `Vision API HTTP ${res.status}`;
		throw new Error(msg);
	}

	const first = data.responses?.[0];
	if (first?.error?.message) {
		throw new Error(first.error.message);
	}

	const text =
		first?.fullTextAnnotation?.text?.trim() ??
		first?.textAnnotations?.[0]?.description?.trim() ??
		"";

	return text;
}
