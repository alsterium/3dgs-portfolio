/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for .spz assets — swap when migrating to Cloudflare R2 (§6.5). */
  readonly VITE_ASSET_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv & { readonly BASE_URL: string };
}
