import AdmZip from "adm-zip";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** 작업 폴더를 원래와 비슷한 상대 경로 구조로 ZIP으로 만든다. */
export async function zipFolderToBuffer(workDirAbs: string, absoluteFilePaths: string[]): Promise<Buffer> {
  const zip = new AdmZip();
  for (const abs of absoluteFilePaths) {
    const rel = path.relative(workDirAbs, abs).split(path.sep).join("/");
    if (!rel || rel.startsWith("..")) continue;
    const data = await readFile(abs);
    zip.addFile(rel, data);
  }
  return zip.toBuffer();
}
