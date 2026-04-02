/** jsDelivr — `next.config`의 `env`로 설치 버전과 동기화 */
function cdnHost(): string {
	return process.env.NEXT_PUBLIC_TESSERACT_CDN_HOST?.replace(/\/$/, "") ?? "https://cdn.jsdelivr.net/npm";
}

export function getBrowserTesseractWorkerOptions() {
	const tj = process.env.NEXT_PUBLIC_TESSERACT_JS_VERSION;
	const tc = process.env.NEXT_PUBLIC_TESSERACT_CORE_VERSION;
	if (typeof tj !== "string" || typeof tc !== "string" || !tj || !tc) {
		throw new Error(
			"Tesseract CDN 버전 환경 변수가 없습니다. next.config의 env(NEXT_PUBLIC_TESSERACT_*_VERSION)를 확인하세요.",
		);
	}
	const host = cdnHost();
	return {
		workerPath: `${host}/tesseract.js@${tj}/dist/worker.min.js`,
		corePath: `${host}/tesseract.js-core@${tc}`,
		workerBlobURL: false,
	};
}
