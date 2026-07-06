/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The site is served from the custom domain 3dgs.alsterium.com at the root,
// so base is "/". BASE_PATH can override it if deployed under a subpath
// (e.g. "/3dgs-portfolio/" for a GitHub Pages project site).
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
