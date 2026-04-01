import { randomUUID } from "node:crypto";

type Entry = { buffer: Buffer; expiresAt: number };

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 32;

const store = new Map<string, Entry>();

function prune(): void {
  const now = Date.now();
  for (const [id, e] of store) {
    if (e.expiresAt < now) store.delete(id);
  }
  while (store.size > MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}

export function storeZipDownload(buffer: Buffer): string {
  prune();
  const id = randomUUID();
  store.set(id, { buffer, expiresAt: Date.now() + TTL_MS });
  return id;
}

/** 소비형: 한 번 읽으면 제거 */
export function consumeZipDownload(id: string): Buffer | null {
  prune();
  const e = store.get(id);
  if (!e || e.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  store.delete(id);
  return e.buffer;
}
