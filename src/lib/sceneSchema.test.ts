import { describe, expect, it } from "vitest";
import { makeManifest, makeScene } from "../test/fixtures";
import { MAX_ASSET_BYTES, manifestSchema, sceneSchema } from "./sceneSchema";

describe("sceneSchema", () => {
  it("accepts a fully specified scene", () => {
    const result = sceneSchema.safeParse(makeScene({ slug: "shibuya-crossing" }));
    expect(result.success).toBe(true);
  });

  it("accepts optional fields (tags, shDegree, numSplats, idleResumeMs)", () => {
    const scene = makeScene({
      slug: "tagged",
      tags: ["outdoor", "drone"],
      shDegree: 2,
      numSplats: 1_800_000,
    });
    scene.camera.idleResumeMs = 8000;
    expect(sceneSchema.safeParse(scene).success).toBe(true);
  });

  it("rejects a missing translation", () => {
    const scene = makeScene({ slug: "broken" });
    // @ts-expect-error deliberately corrupt for the test
    scene.title = { ja: "日本語のみ" };
    expect(sceneSchema.safeParse(scene).success).toBe(false);
  });

  it("rejects assets over the 50MB cap", () => {
    const scene = makeScene({ slug: "huge", fileSizeBytes: MAX_ASSET_BYTES + 1 });
    expect(sceneSchema.safeParse(scene).success).toBe(false);
  });

  it("rejects non-kebab-case slugs", () => {
    for (const slug of ["Bad_Slug", "UPPER", "-leading", "trailing-", "sp ace"]) {
      expect(sceneSchema.safeParse(makeScene({ slug })).success).toBe(false);
    }
  });

  it("rejects inverted camera limits", () => {
    const scene = makeScene({ slug: "limits" });
    scene.camera.limits = { minDistance: 5, maxDistance: 2 };
    expect(sceneSchema.safeParse(scene).success).toBe(false);
  });

  it("rejects duplicate slugs in the manifest", () => {
    const manifest = makeManifest(["a", "a"]);
    expect(manifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects an empty manifest", () => {
    expect(manifestSchema.safeParse({ scenes: [] }).success).toBe(false);
  });
});
