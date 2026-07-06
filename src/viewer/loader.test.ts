import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithProgress, LruCache } from "./loader";

describe("LruCache", () => {
  it("evicts the least recently used entry beyond capacity (FR-13)", () => {
    const evicted: string[] = [];
    const cache = new LruCache<string>(2, (_v, key) => evicted.push(key));

    cache.set("a", "A");
    cache.set("b", "B");
    cache.set("c", "C");
    expect(evicted).toEqual(["a"]);
    expect(cache.keys()).toEqual(["b", "c"]);
  });

  it("refreshes recency on get", () => {
    const evicted: string[] = [];
    const cache = new LruCache<string>(2, (_v, key) => evicted.push(key));

    cache.set("a", "A");
    cache.set("b", "B");
    cache.get("a"); // "a" becomes most recent → "b" is evicted next
    cache.set("c", "C");
    expect(evicted).toEqual(["b"]);
  });

  it("disposes everything on clear", () => {
    const evicted: string[] = [];
    const cache = new LruCache<string>(2, (_v, key) => evicted.push(key));
    cache.set("a", "A");
    cache.set("b", "B");
    cache.clear();
    expect(evicted.sort()).toEqual(["a", "b"]);
    expect(cache.size).toBe(0);
  });
});

describe("fetchWithProgress", () => {
  afterEach(() => vi.unstubAllGlobals());

  function streamResponse(chunks: Uint8Array[], contentLength?: number): Response {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: contentLength != null ? { "content-length": String(contentLength) } : {},
    });
  }

  it("reports byte progress while downloading (FR-11)", async () => {
    const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(chunks, 5)));

    const seen: Array<number | null> = [];
    const bytes = await fetchWithProgress("/a.spz", {
      onProgress: (p) => seen.push(p.fraction),
    });

    expect([...bytes]).toEqual([1, 2, 3, 4, 5]);
    expect(seen).toEqual([0.6, 1]);
  });

  it("reports indeterminate progress without content-length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([new Uint8Array([9])])));
    const seen: Array<number | null> = [];
    await fetchWithProgress("/a.spz", { onProgress: (p) => seen.push(p.fraction) });
    expect(seen).toEqual([null]);
  });

  it("throws on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchWithProgress("/missing.spz")).rejects.toThrow(/404/);
  });

  it("propagates aborts (FR-12)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      }),
    );
    const controller = new AbortController();
    const promise = fetchWithProgress("/a.spz", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(/Aborted/);
  });
});
