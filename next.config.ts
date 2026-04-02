import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "node:path";

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
const tesseractJsVersion = (requireFromRoot("tesseract.js/package.json") as { version: string }).version;
const tesseractCoreVersion = (requireFromRoot("tesseract.js-core/package.json") as { version: string }).version;

const nextConfig: NextConfig = {
	env: {
		NEXT_PUBLIC_TESSERACT_JS_VERSION: tesseractJsVersion,
		NEXT_PUBLIC_TESSERACT_CORE_VERSION: tesseractCoreVersion,
	},
	/** Keep tesseract on real disk paths so worker_threads see a valid worker script. */
	serverExternalPackages: ["tesseract.js", "tesseract.js-core", "sharp", "hanspell"],
	/**
	 * Vercel 서버리스에서 파일 트레이싱이 tesseract.js-core(.wasm 등)를 누락하면 런타임 ENOENT가 난다.
	 * @see https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel (유사 패턴)
	 */
	outputFileTracingIncludes: {
		"/api/ocr-image": [
			"./node_modules/tesseract.js/**/*",
			"./node_modules/tesseract.js-core/**/*",
			"./node_modules/wasm-feature-detect/**/*",
		],
	},
	experimental: {
		serverActions: {
			bodySizeLimit: "50mb",
		},
	},
};

export default nextConfig;
