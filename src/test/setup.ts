import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL can't auto-register cleanup without vitest globals.
afterEach(() => cleanup());

// jsdom doesn't implement element scrolling APIs used by the carousel.
Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {});
