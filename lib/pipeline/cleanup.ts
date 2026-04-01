import { rm } from "node:fs/promises";

/**
 * 분석이 끝난 뒤 임시 디렉터리를 즉시 삭제합니다.
 * Server Action의 `finally`에서 호출하는 패턴을 권장합니다.
 */
export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
