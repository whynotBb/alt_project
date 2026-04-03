/**
 * Browser Tesseract: worker / WASM / traineddata are served from `public/vendor/tesseract`
 * (populated by `scripts/sync-tesseract-public.mjs` on postinstall).
 */
export function getBrowserTesseractWorkerOptions() {
	const base = "/vendor/tesseract";
	return {
		workerPath: `${base}/worker.min.js`,
		corePath: `${base}/core`,
		langPath: `${base}/lang`,
		workerBlobURL: false,
	};
}
