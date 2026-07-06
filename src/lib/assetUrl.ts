/**
 * Splat assets can be served from a different origin than the app
 * (GitHub Pages now, Cloudflare R2 later — PRD §6.5). The base is switched
 * via VITE_ASSET_BASE_URL; when unset, assets resolve relative to the app.
 */
export function assetBaseUrl(): string {
  const configured = import.meta.env.VITE_ASSET_BASE_URL as string | undefined;
  return configured || (import.meta.env.BASE_URL as string) || "/";
}

/** Join a manifest-relative path onto a base URL. Absolute URLs pass through. */
export function resolveUrl(path: string, base: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return base.replace(/\/*$/, "/") + path.replace(/^\/+/, "");
}

/** URL for a splat asset (respects VITE_ASSET_BASE_URL). */
export function resolveAssetUrl(path: string): string {
  return resolveUrl(path, assetBaseUrl());
}

/** URL for app-local static files (scenes.json, thumbnails). */
export function resolveAppUrl(path: string): string {
  return resolveUrl(path, (import.meta.env.BASE_URL as string) || "/");
}
