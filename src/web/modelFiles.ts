// Model files from Hugging Face, fetched once and kept in the browser's Cache Storage, for the workers that run models
// in the browser (the on-device voice, search by meaning).

/** The file's bytes: from the cache when it is there, else downloaded, reporting each chunk, and cached for next time. */
export async function fetchCached(url: string, cacheName: string, onBytes: (count: number) => void, label = url): Promise<Uint8Array> {
  const cache = await caches.open(cacheName).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) {
    const bytes = new Uint8Array(await hit.arrayBuffer());
    onBytes(bytes.length);
    return bytes;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${label}: HTTP ${response.status}`);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
    onBytes(value.length);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  // Kept for the next visit. A full disk only means the next visit downloads again.
  await cache?.put(url, new Response(bytes)).catch(() => {});
  return bytes;
}
