import path from "node:path";
import { createRequire } from "node:module";

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

function readInstalledVersion(pkgName: string): string {
	const pkg = requireFromProject(`${pkgName}/package.json`) as { version: string };
	return pkg.version;
}

/**
 * tesseract.js 문서의 CDN 베이스 (로컬 설치 버전과 동일 태그).
 * - corePath: WASM 번들 디렉터리 — 브라우저 worker 쪽에서 사용; Node worker는 아래 corePath를
 *   옵션으로 받지만 실제 로딩은 `tesseract.js-core` npm(require)이며 Vercel에서는 output file tracing으로 포함돼야 함.
 * - cdnWorkerMinJs: `dist/worker.min.js` — 브라우저 Web Worker 전용. Node `worker_threads`는 사용 불가.
 */
export function getTesseractCdnConfig() {
	const tesseractVersion = readInstalledVersion("tesseract.js");
	const coreVersion = readInstalledVersion("tesseract.js-core");
	return {
		tesseractVersion,
		coreVersion,
		cdnWorkerMinJs: `https://cdn.jsdelivr.net/npm/tesseract.js@${tesseractVersion}/dist/worker.min.js`,
		cdnCorePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${coreVersion}`,
	};
}

/**
 * createWorker(..., options) — 수동 경로 설정.
 *
 * Node OCR 경로: `worker_threads`가 실행하는 스크립트는 `worker-script/node`(parentPort)이어야 하며,
 * CDN의 worker.min.js(importScripts)는 Node 워커와 호환되지 않습니다.
 * 따라서 workerPath는 항상 설치된 패키지의 로컬 파일로 둡니다.
 *
 * corePath는 공식 문서와 동일하게 jsDelivr 디렉터리 URL을 넘깁니다(향후/브라우저 일치·로깅용).
 * 현재 Node worker의 getCore는 npm `tesseract.js-core`를 require합니다 — Vercel 배포 시
 * `next.config.ts`의 `outputFileTracingIncludes`로 해당 패키지 전체가 서버 번들에 포함되어야 합니다.
 */
export function getTesseractWorkerOptions() {
	const { cdnCorePath } = getTesseractCdnConfig();
	const tesseractPkgRoot = path.dirname(requireFromProject.resolve("tesseract.js/package.json"));
	const nodeWorkerScript = path.join(tesseractPkgRoot, "src", "worker-script", "node", "index.js");

	return {
		/** Node `worker_threads`용 — CDN `worker.min.js`는 여기서 쓸 수 없음 */
		workerPath: nodeWorkerScript,
		/** jsDelivr — 설치된 `tesseract.js-core` 버전과 동일 */
		corePath: cdnCorePath,
	};
}
