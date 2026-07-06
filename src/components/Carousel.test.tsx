import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../lib/i18n";
import { makeManifest } from "../test/fixtures";
import { Carousel } from "./Carousel";

const scenes = makeManifest(["alpha", "beta", "gamma"]).scenes;

beforeAll(async () => {
  await i18n.changeLanguage("ja");
});

describe("Carousel", () => {
  it("renders one option per scene with lazy thumbnails (FR-6/FR-9)", () => {
    render(<Carousel scenes={scenes} selectedSlug="alpha" lang="ja" onSelect={() => {}} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    for (const img of screen.getAllByRole("img")) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img.getAttribute("alt")).toBeTruthy();
    }
  });

  it("marks the selected scene (FR-8)", () => {
    render(<Carousel scenes={scenes} selectedSlug="beta" lang="ja" onSelect={() => {}} />);
    const selected = screen.getByRole("option", { selected: true });
    expect(selected).toHaveAttribute("id", "scene-thumb-beta");
  });

  it("selects a scene on click (FR-7)", async () => {
    const onSelect = vi.fn();
    render(<Carousel scenes={scenes} selectedSlug="alpha" lang="ja" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("option", { name: /gamma/i }));
    expect(onSelect).toHaveBeenCalledWith("gamma");
  });

  it("steps with the arrow buttons, wrapping around (FR-7)", async () => {
    const onSelect = vi.fn();
    render(<Carousel scenes={scenes} selectedSlug="alpha" lang="ja" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "前のシーン" }));
    expect(onSelect).toHaveBeenCalledWith("gamma");
    await userEvent.click(screen.getByRole("button", { name: "次のシーン" }));
    expect(onSelect).toHaveBeenCalledWith("beta");
  });

  it("uses the active language for labels (FR-17)", () => {
    render(<Carousel scenes={scenes} selectedSlug="alpha" lang="en" onSelect={() => {}} />);
    expect(screen.getByText("Scene alpha")).toBeInTheDocument();
  });
});
