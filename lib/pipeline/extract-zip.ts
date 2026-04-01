import AdmZip from "adm-zip";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function assertSafeExtractPath(targetDir: string, entryName: string): string {
  const normalized = entryName.replace(/\\/g, "/").replace(/^\/+/, "");
  const base = path.resolve(targetDir);
  const resolved = path.resolve(path.join(targetDir, normalized));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`ZIP 경로 이스케이프 시도가 차단되었습니다: ${entryName}`);
  }
  return resolved;
}

/**
 * ZIP 바이너리를 `targetDir` 아래에 풀어둡니다. Zip Slip 방지를 위해 경로를 검증합니다.
 */
export async function extractZipBufferToDir(buffer: Buffer, targetDir: string): Promise<void> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  for (const entry of entries) {
    const name = entry.entryName.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name) continue;

    const outPath = assertSafeExtractPath(targetDir, name);
    if (entry.isDirectory || name.endsWith("/")) {
      await mkdir(outPath, { recursive: true });
      continue;
    }
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, entry.getData());
  }
}
