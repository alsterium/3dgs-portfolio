import type { Scene, SceneManifest } from "../lib/sceneSchema";

export function makeScene(overrides: Partial<Scene> & { slug: string }): Scene {
  return {
    asset: `assets/${overrides.slug}.spz`,
    fileSizeBytes: 12_400_000,
    capturedAt: "2026-05-12",
    title: { ja: `シーン ${overrides.slug}`, en: `Scene ${overrides.slug}` },
    description: { ja: "説明", en: "Description" },
    equipment: { ja: "ミラーレス一眼", en: "Mirrorless" },
    pipeline: { ja: "nerfstudio → spz", en: "nerfstudio → spz" },
    camera: {
      target: [0, 1, 0],
      initialPosition: [3, 2, 3],
      orbit: { radius: 4, height: 2, speedDegPerSec: 8 },
      limits: { minDistance: 1.5, maxDistance: 10 },
    },
    thumbnail: `thumbs/${overrides.slug}.webp`,
    ...overrides,
  };
}

export function makeManifest(slugs: string[]): SceneManifest {
  return { scenes: slugs.map((slug) => makeScene({ slug })) };
}
