import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/** Keep tesseract on real disk paths so worker_threads see a valid worker script. */
	serverExternalPackages: ["tesseract.js", "tesseract.js-core", "sharp", "hanspell"],
	experimental: {
		serverActions: {
			bodySizeLimit: "50mb",
		},
	},
};

export default nextConfig;
