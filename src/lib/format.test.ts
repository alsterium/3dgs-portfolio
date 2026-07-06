import { describe, expect, it } from "vitest";
import { formatMegabytes, formatSplats } from "./format";
import { otherLang, toLang } from "./localized";

describe("format helpers", () => {
  it("formats bytes as SI megabytes", () => {
    expect(formatMegabytes(18_300_000)).toBe("18.3 MB");
    expect(formatMegabytes(496_044)).toBe("0.5 MB");
  });

  it("formats splat counts", () => {
    expect(formatSplats(1_800_000)).toBe("1.8M");
    expect(formatSplats(52_000)).toBe("52K");
    expect(formatSplats(420)).toBe("420");
  });
});

describe("language helpers", () => {
  it("normalizes i18next codes", () => {
    expect(toLang("ja")).toBe("ja");
    expect(toLang("ja-JP")).toBe("ja");
    expect(toLang("en-US")).toBe("en");
    expect(toLang(undefined)).toBe("en");
  });

  it("flips languages", () => {
    expect(otherLang("ja")).toBe("en");
    expect(otherLang("en")).toBe("ja");
  });
});
