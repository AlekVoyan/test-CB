/**
 * Requests per address in a sliding window. Best effort only: on serverless every instance keeps its own window.
 * The real cap is the spend limit on each API key.
 */
export function rateLimiter(maxPerWindow: number, windowMs = 60_000): (ip: string) => boolean {
  const hits = new Map<string, number[]>();
  return (ip) => {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > maxPerWindow;
  };
}
