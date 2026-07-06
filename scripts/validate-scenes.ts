/**
 * CI gate for the scene manifest (PRD §6.3):
 *  - zod schema validation (required fields, both translations present),
 *  - asset files exist and stay under the 50MB cap (§5.1),
 *  - fileSizeBytes matches the actual asset size,
 *  - thumbnails exist (error with --require-thumbs, warning otherwise).
 *
 * Usage: npm run validate [-- --require-thumbs]
 */
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_ASSET_BYTES, manifestSchema } from "../src/lib/sceneSchema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const requireThumbs = process.argv.includes("--require-thumbs");

const errors: string[] = [];
const warnings: string[] = [];

const raw = await readFile(path.join(publicDir, "scenes.json"), "utf8");
const parsed = manifestSchema.safeParse(JSON.parse(raw));

if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    errors.push(`schema: ${issue.path.join(".")} — ${issue.message}`);
  }
} else {
  for (const scene of parsed.data.scenes) {
    const assetPath = path.join(publicDir, scene.asset);
    if (!existsSync(assetPath)) {
      errors.push(`${scene.slug}: asset not found at public/${scene.asset}`);
    } else {
      const actual = statSync(assetPath).size;
      if (actual > MAX_ASSET_BYTES) {
        errors.push(
          `${scene.slug}: asset is ${actual} bytes, over the ${MAX_ASSET_BYTES} byte cap`,
        );
      }
      if (actual !== scene.fileSizeBytes) {
        errors.push(
          `${scene.slug}: fileSizeBytes is ${scene.fileSizeBytes} but the asset is ${actual} bytes`,
        );
      }
    }

    const thumbPath = path.join(publicDir, scene.thumbnail);
    if (!existsSync(thumbPath)) {
      const msg = `${scene.slug}: thumbnail not found at public/${scene.thumbnail} (run: npm run build && npm run thumbs)`;
      (requireThumbs ? errors : warnings).push(msg);
    }
  }
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

if (errors.length > 0) {
  console.error(`\nscenes.json validation failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`scenes.json OK (${parsed.success ? parsed.data.scenes.length : 0} scenes)`);
