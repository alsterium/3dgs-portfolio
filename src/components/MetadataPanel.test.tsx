import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../lib/i18n";
import { makeScene } from "../test/fixtures";
import { MetadataPanel, MobileDetails } from "./MetadataPanel";

beforeAll(async () => {
  await i18n.changeLanguage("ja");
});

const scene = makeScene({
  slug: "spec-scene",
  fileSizeBytes: 18_300_000,
  numSplats: 2_100_000,
  shDegree: 3,
});

describe("MetadataPanel (desktop)", () => {
  it("shows all FR-14 metadata", () => {
    render(<MetadataPanel scene={scene} lang="ja" />);
    expect(screen.getByText("説明")).toBeInTheDocument(); // description
    expect(screen.getByText("18.3 MB")).toBeInTheDocument();
    expect(screen.getByText("2.1M")).toBeInTheDocument();
    expect(screen.getByText("SH3")).toBeInTheDocument();
    expect(screen.getByText("2026-05-12")).toBeInTheDocument();
    expect(screen.getByText("ミラーレス一眼")).toBeInTheDocument();
    expect(screen.getByText("nerfstudio → spz")).toBeInTheDocument();
  });

  it("collapses and expands (FR-15)", async () => {
    render(<MetadataPanel scene={scene} lang="ja" />);
    const toggle = screen.getByRole("button", { name: "閉じる" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(screen.queryByText("18.3 MB")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "開く" }));
    expect(screen.getByText("18.3 MB")).toBeInTheDocument();
  });

  it("omits optional rows when absent", () => {
    const minimal = makeScene({ slug: "minimal" });
    render(<MetadataPanel scene={minimal} lang="ja" />);
    expect(screen.queryByText("スプラット数")).not.toBeInTheDocument();
    expect(screen.queryByText("SH次数")).not.toBeInTheDocument();
  });
});

describe("MobileDetails", () => {
  it("starts collapsed and expands on tap (FR-15)", async () => {
    render(<MobileDetails scene={scene} lang="ja" />);
    expect(screen.queryByText("18.3 MB")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "詳細" }));
    expect(screen.getByText("18.3 MB")).toBeInTheDocument();
  });

  it("renders the localized title in both languages", () => {
    render(<MobileDetails scene={scene} lang="en" />);
    expect(screen.getByRole("heading", { name: "Scene spec-scene" })).toBeInTheDocument();
    expect(screen.getByText("シーン spec-scene")).toBeInTheDocument();
  });
});
