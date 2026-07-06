import { z } from "zod";

/** Hard cap for a single .spz asset (PRD §5.1 / §6.5 — GitHub Pages constraint). */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const localizedTextSchema = z.object({
  ja: z.string().min(1),
  en: z.string().min(1),
});

export const orbitSchema = z.object({
  /** Horizontal distance from the orbit target, in scene units. */
  radius: z.number().positive(),
  /** Camera height relative to the orbit target. */
  height: z.number(),
  /** Angular speed of the auto-orbit. Negative values reverse direction. */
  speedDegPerSec: z.number(),
});

export const cameraSchema = z.object({
  target: vec3Schema,
  initialPosition: vec3Schema,
  orbit: orbitSchema,
  limits: z
    .object({
      minDistance: z.number().positive(),
      maxDistance: z.number().positive(),
    })
    .refine((l) => l.maxDistance > l.minDistance, {
      message: "maxDistance must be greater than minDistance",
    }),
  /** Milliseconds of inactivity before auto-orbit resumes (FR-4). */
  idleResumeMs: z.number().int().positive().optional(),
});

export const sceneSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be a lowercase kebab-case identifier",
  }),
  asset: z.string().min(1),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_ASSET_BYTES, { message: `asset exceeds the ${MAX_ASSET_BYTES} byte limit` }),
  capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "capturedAt must be an ISO date (YYYY-MM-DD)",
  }),
  /** Language-independent tag slugs. Not rendered in the initial release (PRD §6.3). */
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  /** Spherical-harmonics degree the asset was encoded with (PRD §6.2). */
  shDegree: z.number().int().min(0).max(3).optional(),
  numSplats: z.number().int().positive().optional(),
  title: localizedTextSchema,
  description: localizedTextSchema,
  equipment: localizedTextSchema,
  pipeline: localizedTextSchema,
  camera: cameraSchema,
  thumbnail: z.string().min(1),
});

export const manifestSchema = z
  .object({
    scenes: z.array(sceneSchema).min(1),
  })
  .refine((m) => new Set(m.scenes.map((s) => s.slug)).size === m.scenes.length, {
    message: "scene slugs must be unique",
  });

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type SceneCamera = z.infer<typeof cameraSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneManifest = z.infer<typeof manifestSchema>;
