export type ProgressInfo = {
  loaded: number;
  total: number | null;
  /** 0–1 when total is known, otherwise null (indeterminate). */
  fraction: number | null;
};

/**
 * Download an asset with byte-level progress reporting (FR-11) and abort
 * support (FR-12).
 */
export async function fetchWithProgress(
  url: string,
  options: { signal?: AbortSignal; onProgress?: (progress: ProgressInfo) => void } = {},
): Promise<Uint8Array> {
  const { signal, onProgress } = options;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  const lengthHeader = res.headers.get("content-length");
  const total = lengthHeader ? Number.parseInt(lengthHeader, 10) || null : null;

  if (!res.body) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength, fraction: 1 });
    return bytes;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({
      loaded,
      total,
      fraction: total ? Math.min(1, loaded / total) : null,
    });
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Tiny LRU keyed by scene slug. FR-13: keep only the last 1–2 loaded scenes
 * in memory and dispose everything older (mobile memory budget).
 */
export class LruCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(
    private readonly capacity: number,
    private readonly onEvict?: (value: T, key: string) => void,
  ) {
    if (capacity < 1) throw new Error("LruCache capacity must be >= 1");
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  get(key: string): T | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key) as T;
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string;
      const evicted = this.entries.get(oldest) as T;
      this.entries.delete(oldest);
      this.onEvict?.(evicted, oldest);
    }
  }

  clear(): void {
    for (const [key, value] of this.entries) {
      this.onEvict?.(value, key);
    }
    this.entries.clear();
  }
}
