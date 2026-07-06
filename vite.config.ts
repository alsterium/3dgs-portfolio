/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// BASE_PATH is set by CI when deploying to GitHub Pages project sites
// (e.g. "/3dgs-portfolio/"). Defaults to "/" for local dev and custom domains.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Spark ships web workers that break under dev-time pre-bundling.
    exclude: ["@sparkjsdev/spark"],
  },
  build: {
    target: "esnext",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
