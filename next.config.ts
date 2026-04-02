import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
