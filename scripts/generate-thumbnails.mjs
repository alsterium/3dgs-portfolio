/**
 * Build-time thumbnail generation (PRD §6.4 / FR-21, FR-22).
 *
 * Serves the built app (dist/) with `vite preview`, opens each scene in
 * headless Chromium at `/#/scene/{slug}?thumb=1` (fixed camera at the
 * scene's initialPosition), screenshots the canvas and writes:
 *   public/thumbs/{slug}.webp      (carousel size)
 *   public/thumbs/{slug}.jpg       (JPEG fallback)
 *   public/thumbs/{slug}-lg.webp   (large / social size)
 *
 * Scenes whose asset+camera hash is unchanged are skipped
 * (public/thumbs/thumbs-manifest.json). Thumbnails are committed to the
 * repo so CI failures fall back to the last locally generated set (§9).
 *
 * Usage: npm run build && npm run thumbs [-- --force]
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { preview } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");
const thumbsDir = path.join(publicDir, "thumbs");
const hashManifestPath = path.join(thumbsDir, "thumbs-manifest.json");
const force = process.argv.includes("--force");

const CAROUSEL_WIDTH = 480;
const LARGE_WIDTH = 1280;
const VIEWPORT = { width: 1200, height: 740 };

if (!existsSync(path.join(distDir, "index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(path.join(publicDir, "scenes.json"), "utf8"));

async function sceneHash(scene) {
  const asset = await readFile(path.join(publicDir, scene.asset));
  return createHash("sha256")
    .update(asset)
    .update(JSON.stringify(scene.camera))
    .digest("hex")
    .slice(0, 16);
}

function thumbFiles(slug) {
  return [`${slug}.webp`, `${slug}.jpg`, `${slug}-lg.webp`].map((f) => path.join(thumbsDir, f));
}

await mkdir(thumbsDir, { recursive: true });
let hashes = {};
try {
  hashes = JSON.parse(await readFile(hashManifestPath, "utf8"));
} catch {
  /* first run */
}

const pending = [];
for (const scene of manifest.scenes) {
  const hash = await sceneHash(scene);
  const upToDate =
    !force && hashes[scene.slug] === hash && thumbFiles(scene.slug).every((f) => existsSync(f));
  if (upToDate) {
    console.log(`skip ${scene.slug} (unchanged)`);
  } else {
    pending.push({ scene, hash });
  }
}

async function copyThumbsIntoDist() {
  // Keep the already-built dist in sync so a deploy after generation ships
  // the fresh thumbnails.
  const distThumbs = path.join(distDir, "thumbs");
  await mkdir(distThumbs, { recursive: true });
  for (const scene of manifest.scenes) {
    for (const file of thumbFiles(scene.slug)) {
      if (existsSync(file)) {
        await copyFile(file, path.join(distThumbs, path.basename(file)));
      }
    }
  }
  await copyFile(hashManifestPath, path.join(distThumbs, "thumbs-manifest.json"));
}

if (pending.length === 0) {
  await copyThumbsIntoDist();
  console.log("All thumbnails up to date.");
  process.exit(0);
}

function findChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    (() => {
      try {
        return chromium.executablePath();
      } catch {
        return undefined;
      }
    })(),
    // Pre-provisioned browser in sandboxed/CI environments whose build
    // revision may not match this playwright version.
    process.env.PLAYWRIGHT_BROWSERS_PATH &&
      path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium"),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  console.error(
    "Chromium not found — run `npx playwright install chromium` or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.",
  );
  process.exit(1);
}

const server = await preview({ preview: { port: 4319, strictPort: false } });
const origin = server.resolvedUrls?.local?.[0] ?? "http://localhost:4319/";

const executablePath = findChromium();
const browser = await chromium.launch({
  executablePath,
  // SwiftShader keeps WebGL2 working on GPU-less CI runners (§6.4 risk note).
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-gpu"],
});

let failed = 0;
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on("pageerror", (err) => console.error(`  pageerror: ${err.message}`));

  for (const { scene, hash } of pending) {
    const url = `${origin.replace(/\/$/, "")}/#/scene/${scene.slug}?thumb=1`;
    console.log(`render ${scene.slug} …`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__THUMB_READY === true, null, { timeout: 90_000 });
      // Swiftshader (no real GPU on CI/sandboxed runners) makes the readback
      // slow for larger real-world captures (multi-minute for million-splat
      // scenes) — give it much more than the 30s default.
      const png = await page.locator("canvas").screenshot({ type: "png", timeout: 600_000 });

      const base = sharp(png);
      await base
        .clone()
        .resize({ width: CAROUSEL_WIDTH })
        .webp({ quality: 82 })
        .toFile(path.join(thumbsDir, `${scene.slug}.webp`));
      await base
        .clone()
        .resize({ width: CAROUSEL_WIDTH })
        .jpeg({ quality: 82 })
        .toFile(path.join(thumbsDir, `${scene.slug}.jpg`));
      await base
        .clone()
        .resize({ width: LARGE_WIDTH })
        .webp({ quality: 85 })
        .toFile(path.join(thumbsDir, `${scene.slug}-lg.webp`));

      hashes[scene.slug] = hash;
      console.log(`  ok ${scene.slug}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ${scene.slug}: ${err.message}`);
    }
  }
} finally {
  await browser.close();
  await writeFile(hashManifestPath, `${JSON.stringify(hashes, null, 2)}\n`);
  await copyThumbsIntoDist();
  await server.close();
}

if (failed > 0) {
  console.error(`${failed} thumbnail(s) failed to render.`);
  process.exit(1);
}
console.log("Thumbnails generated.");
