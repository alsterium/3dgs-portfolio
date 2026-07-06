/** "18300000" → "18.3 MB" (SI megabytes, one decimal). */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** "1800000" → "1.8M", "980000" → "0.98M" style splat-count shorthand. */
export function formatSplats(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return String(count);
}
