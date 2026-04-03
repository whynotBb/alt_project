/**
 * Copies tesseract.js worker, tesseract.js-core (WASM), and kor+eng traineddata
 * into public/vendor/tesseract so the browser loads everything same-origin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const destRoot = path.join(root, "public", "vendor", "tesseract");
const workerSrc = path.join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
const coreSrc = path.join(root, "node_modules", "tesseract.js-core");
const korData = path.join(root, "node_modules", "@tesseract.js-data", "kor", "4.0.0", "kor.traineddata.gz");
const engData = path.join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz");

function die(msg) {
	console.error(`[sync-tesseract-public] ${msg}`);
	process.exit(1);
}

if (!fs.existsSync(workerSrc)) die(`missing ${workerSrc} — run npm install`);
if (!fs.existsSync(coreSrc)) die(`missing ${coreSrc} — run npm install`);
if (!fs.existsSync(korData)) die(`missing ${korData} — ensure @tesseract.js-data/kor is installed`);
if (!fs.existsSync(engData)) die(`missing ${engData} — ensure @tesseract.js-data/eng is installed`);

fs.mkdirSync(destRoot, { recursive: true });
const coreDest = path.join(destRoot, "core");
const langDest = path.join(destRoot, "lang");
fs.rmSync(coreDest, { recursive: true, force: true });
fs.mkdirSync(coreDest, { recursive: true });
fs.mkdirSync(langDest, { recursive: true });

fs.copyFileSync(workerSrc, path.join(destRoot, "worker.min.js"));

for (const name of fs.readdirSync(coreSrc)) {
	if (name.endsWith(".js") || name.endsWith(".wasm")) {
		fs.copyFileSync(path.join(coreSrc, name), path.join(coreDest, name));
	}
}

fs.copyFileSync(korData, path.join(langDest, "kor.traineddata.gz"));
fs.copyFileSync(engData, path.join(langDest, "eng.traineddata.gz"));

console.log("[sync-tesseract-public] synced to public/vendor/tesseract");
