/**
 * Generate small synthetic .spz demo assets with Spark's own SpzWriter and
 * sync fileSizeBytes / numSplats into public/scenes.json.
 *
 * These are placeholder scenes so the viewer works end-to-end before real
 * 3DGS captures are added (real assets follow the PRD §6.6 flow instead).
 *
 * Usage: node scripts/generate-demo-scenes.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpzWriter } from "@sparkjsdev/spark";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "public", "assets");
const manifestPath = path.join(root, "public", "scenes.json");

/** Deterministic PRNG so regenerated assets are reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/**
 * Splat emitted in three.js y-up space; converted here to the y-down splat
 * file convention (the viewer flips meshes 180° about X, like Spark's docs).
 */
function makeEmitter(writer) {
  let index = 0;
  return {
    emit({ pos, scale, color, alpha, quat = [0, 0, 0, 1] }) {
      const [x, y, z] = pos;
      writer.setCenter(index, x, -y, -z);
      writer.setScale(index, ...scale);
      writer.setRgb(index, ...color);
      writer.setAlpha(index, alpha);
      writer.setQuat(index, ...quat);
      index += 1;
    },
    get count() {
      return index;
    },
  };
}

/** Quaternion rotating +Z onto dir (already in file space). */
function quatFromZTo(dir) {
  const [x, y, z] = dir;
  const w = 1 + z;
  if (w < 1e-6) return [1, 0, 0, 0];
  const q = [-y, x, 0, w];
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

function torusKnot(emit, rand) {
  const P = 2;
  const Q = 3;
  const N = 42000;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = 0.42 * (2 + Math.cos(Q * t));
    const cx = r * Math.cos(P * t);
    const cy = 0.42 * Math.sin(Q * t) + 0.9;
    const cz = r * Math.sin(P * t);
    const jx = gaussian(rand) * 0.05;
    const jy = gaussian(rand) * 0.05;
    const jz = gaussian(rand) * 0.05;
    const s = 0.012 + rand() * 0.02;
    const [cr, cg, cb] = hsl((t / (Math.PI * 2) + 0.6) % 1, 0.75, 0.6);
    emit.emit({
      pos: [cx + jx, cy + jy, cz + jz],
      scale: [s, s, s],
      color: [cr, cg, cb],
      alpha: 0.55 + rand() * 0.35,
    });
  }
}

function galaxy(emit, rand) {
  const ARMS = 2;
  const N = 52000;
  for (let i = 0; i < N; i++) {
    const core = rand() < 0.22;
    if (core) {
      const rr = Math.abs(gaussian(rand)) * 0.22;
      const th = rand() * Math.PI * 2;
      const ph = rand() * Math.PI;
      const s = 0.015 + rand() * 0.02;
      emit.emit({
        pos: [
          rr * Math.sin(ph) * Math.cos(th),
          rr * Math.cos(ph) * 0.7 + 0.85,
          rr * Math.sin(ph) * Math.sin(th),
        ],
        scale: [s, s, s],
        color: [1, 0.92, 0.78],
        alpha: 0.5 + rand() * 0.4,
      });
      continue;
    }
    const r = Math.sqrt(rand()) * 1.7;
    const arm = Math.floor(rand() * ARMS);
    const theta = (arm * Math.PI * 2) / ARMS + r * 2.6 + gaussian(rand) * (0.18 + 0.1 * r);
    const y = gaussian(rand) * 0.035 * Math.max(0.4, 1.2 - r * 0.5) + 0.85;
    const mix = Math.min(1, r / 1.7);
    const color = [1 - 0.45 * mix, 0.9 - 0.25 * mix, 0.78 + 0.22 * mix];
    const s = 0.01 + rand() * 0.022;
    emit.emit({
      pos: [r * Math.cos(theta), y, r * Math.sin(theta)],
      scale: [s, s, s * 0.6],
      color,
      alpha: (0.28 + rand() * 0.45) * Math.max(0.35, 1.1 - r * 0.35),
    });
  }
}

function crystal(emit, rand) {
  const PRISMS = 16;
  for (let p = 0; p < PRISMS; p++) {
    const az = rand() * Math.PI * 2;
    const el = 0.35 + rand() * 1.1;
    const dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const len = 0.5 + rand() * 0.9;
    const width = 0.035 + rand() * 0.04;
    const hue = 0.48 + rand() * 0.28;
    const n = 1600 + Math.floor(rand() * 900);
    // File-space direction (y/z negated) for the elongated splat orientation.
    const quat = quatFromZTo(
      [dir[0], -dir[1], -dir[2]].map((v, _, arr) => {
        const norm = Math.hypot(...arr);
        return v / norm;
      }),
    );
    for (let i = 0; i < n; i++) {
      const along = rand() ** 0.8 * len;
      const taper = Math.max(0.15, 1 - along / len);
      const rr = Math.abs(gaussian(rand)) * width * taper;
      const th = rand() * Math.PI * 2;
      const ox = Math.cos(th) * rr;
      const oy = Math.sin(th) * rr;
      const orth1 = [-dir[2], 0, dir[0]];
      const o1n = Math.hypot(...orth1) || 1;
      const orth2 = [
        (dir[1] * orth1[2]) / o1n - (dir[2] * orth1[1]) / o1n,
        (dir[2] * orth1[0]) / o1n - (dir[0] * orth1[2]) / o1n,
        (dir[0] * orth1[1]) / o1n - (dir[1] * orth1[0]) / o1n,
      ];
      const [cr, cg, cb] = hsl(hue, 0.65, 0.55 + taper * 0.2);
      emit.emit({
        pos: [
          dir[0] * along + (orth1[0] / o1n) * ox + orth2[0] * oy,
          dir[1] * along + (orth1[1] / o1n) * ox + orth2[1] * oy + 0.12,
          dir[2] * along + (orth1[2] / o1n) * ox + orth2[2] * oy,
        ],
        scale: [width * 0.35, width * 0.35, width * 1.6],
        color: [cr, cg, cb],
        alpha: 0.35 + rand() * 0.4,
        quat,
      });
    }
  }
  // Ground sparkle
  for (let i = 0; i < 6000; i++) {
    const r = Math.sqrt(rand()) * 1.3;
    const th = rand() * Math.PI * 2;
    const s = 0.008 + rand() * 0.012;
    emit.emit({
      pos: [r * Math.cos(th), 0.02 + rand() * 0.03, r * Math.sin(th)],
      scale: [s, s, s * 0.4],
      color: [0.65, 0.75, 0.85],
      alpha: 0.15 + rand() * 0.25,
    });
  }
}

const GENERATORS = [
  { slug: "demo-torus-knot", build: torusKnot, seed: 11 },
  { slug: "demo-galaxy", build: galaxy, seed: 22 },
  { slug: "demo-crystal", build: crystal, seed: 33 },
];

// Count first, then write — SpzWriter needs numSplats up front.
function countSplats(build, seed) {
  let count = 0;
  const counter = { emit: () => (count += 1) };
  build(counter, mulberry32(seed));
  return count;
}

await mkdir(assetsDir, { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const { slug, build, seed } of GENERATORS) {
  const numSplats = countSplats(build, seed);
  const writer = new SpzWriter({ numSplats, shDegree: 0 });
  const emitter = makeEmitter(writer);
  build(emitter, mulberry32(seed));
  const bytes = await writer.finalize();
  const file = path.join(assetsDir, `${slug}.spz`);
  await writeFile(file, bytes);
  console.log(`${slug}: ${numSplats} splats, ${(bytes.length / 1024).toFixed(0)} KiB`);

  const entry = manifest.scenes.find((s) => s.slug === slug);
  if (entry) {
    entry.fileSizeBytes = bytes.length;
    entry.numSplats = numSplats;
    entry.shDegree = 0;
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("scenes.json updated");
