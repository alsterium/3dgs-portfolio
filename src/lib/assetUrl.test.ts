import { describe, expect, it } from "vitest";
import { resolveUrl } from "./assetUrl";

describe("resolveUrl", () => {
  it("joins a relative path onto a base", () => {
    expect(resolveUrl("assets/a.spz", "/")).toBe("/assets/a.spz");
    expect(resolveUrl("assets/a.spz", "/3dgs-portfolio/")).toBe("/3dgs-portfolio/assets/a.spz");
  });

  it("normalizes duplicate slashes at the join point", () => {
    expect(resolveUrl("/assets/a.spz", "/base")).toBe("/base/assets/a.spz");
    expect(resolveUrl("assets/a.spz", "/base///")).toBe("/base/assets/a.spz");
  });

  it("supports absolute asset bases (Cloudflare R2 migration path)", () => {
    expect(resolveUrl("assets/a.spz", "https://cdn.example.com/splats/")).toBe(
      "https://cdn.example.com/splats/assets/a.spz",
    );
  });

  it("passes through already-absolute asset URLs", () => {
    expect(resolveUrl("https://cdn.example.com/a.spz", "/base/")).toBe(
      "https://cdn.example.com/a.spz",
    );
  });
});
