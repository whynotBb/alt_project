import path from "node:path";
import { createRequire } from "node:module";

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

function cdnHost(): string {
	return process.env.TESSERACT_CDN_HOST?.replace(/\/$/, "") ?? "https://cdn.jsdelivr.net/npm";
}

export type TesseractCdnVersions = {
	tesseractJs: string;
	tesseractCore: string;
};

export function readTesseractCdnVersions(): TesseractCdnVersions {
	return {
		tesseractJs: (requireFromProject("tesseract.js/package.json") as { version: string }).version,
		tesseractCore: (requireFromProject("tesseract.js-core/package.json") as { version: string }).version,
	};
}

export function buildTesseractCdnUrls(v: TesseractCdnVersions) {
	const host = cdnHost();
	return {
		workerMinJs: `${host}/tesseract.js@${v.tesseractJs}/dist/worker.min.js`,
		corePath: `${host}/tesseract.js-core@${v.tesseractCore}`,
	};
}

/**
 * Node `worker_threads` — worker 스크립트는 로컬 worker-script만 가능.
 * WASM 번들은 npm require(파일 트레이싱) + load 시 corePath(CDN) 정합성용.
 */
export function getServerTesseractWorkerOptions() {
	const urls = buildTesseractCdnUrls(readTesseractCdnVersions());
	const tesseractPkgRoot = path.dirname(requireFromProject.resolve("tesseract.js/package.json"));
	const nodeWorkerScript = path.join(tesseractPkgRoot, "src", "worker-script", "node", "index.js");

	return {
		workerPath: nodeWorkerScript,
		corePath: urls.corePath,
		workerBlobURL: false,
	};
}
