import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { SceneCamera } from "../lib/sceneSchema";
import { AutoOrbitController, DEFAULT_BLEND_MS, DEFAULT_IDLE_RESUME_MS } from "./orbit";

const CAMERA: SceneCamera = {
  target: [0, 1, 0],
  initialPosition: [3, 2, 3],
  orbit: { radius: 4, height: 2, speedDegPerSec: 90 },
  limits: { minDistance: 1, maxDistance: 10 },
};

function run(
  orbit: AutoOrbitController,
  ms: number,
  position: THREE.Vector3,
  target: THREE.Vector3,
  stepMs = 16,
): void {
  for (let t = 0; t < ms; t += stepMs) {
    orbit.update(stepMs, position, target);
  }
}

function horizontalRadius(position: THREE.Vector3, target: THREE.Vector3): number {
  return Math.hypot(position.x - target.x, position.z - target.z);
}

describe("AutoOrbitController", () => {
  it("blends from the initial pose onto the orbit trajectory (FR-2)", () => {
    const orbit = new AutoOrbitController(CAMERA);
    const position = new THREE.Vector3(...CAMERA.initialPosition);
    const target = new THREE.Vector3(...CAMERA.target);

    expect(orbit.mode).toBe("blending");
    run(orbit, DEFAULT_BLEND_MS + 200, position, target);

    expect(orbit.mode).toBe("auto");
    expect(horizontalRadius(position, target)).toBeCloseTo(CAMERA.orbit.radius, 3);
    expect(position.y - target.y).toBeCloseTo(CAMERA.orbit.height, 3);
    expect(target.toArray()).toEqual(CAMERA.target);
  });

  it("keeps rotating in auto mode at the configured speed", () => {
    const orbit = new AutoOrbitController(CAMERA, { blendMs: 0 });
    const position = new THREE.Vector3(...CAMERA.initialPosition);
    const target = new THREE.Vector3(...CAMERA.target);

    orbit.update(16, position, target); // finish the zero-length blend
    const a = position.clone();
    // 90°/s → a full second should rotate the camera a quarter turn.
    run(orbit, 1000, position, target);
    const angle = a.sub(target).angleTo(position.clone().sub(target));
    expect(THREE.MathUtils.radToDeg(angle)).toBeGreaterThan(45);
  });

  it("stops while the user interacts (FR-3)", () => {
    const orbit = new AutoOrbitController(CAMERA);
    const position = new THREE.Vector3(...CAMERA.initialPosition);
    const target = new THREE.Vector3(...CAMERA.target);

    orbit.onInteractStart();
    const before = position.clone();
    expect(orbit.update(500, position, target)).toBe(false);
    expect(position).toEqual(before);
  });

  it("resumes after the idle timeout and re-converges (FR-4)", () => {
    const orbit = new AutoOrbitController(CAMERA);
    const position = new THREE.Vector3(...CAMERA.initialPosition);
    const target = new THREE.Vector3(...CAMERA.target);
    run(orbit, DEFAULT_BLEND_MS + 200, position, target);

    // User grabs the camera and drops it somewhere else.
    orbit.onInteractStart();
    position.set(8, 5, -2);
    target.set(0.5, 1.5, 0.5);
    orbit.onInteractEnd();

    expect(orbit.update(DEFAULT_IDLE_RESUME_MS - 100, position, target)).toBe(false);
    expect(orbit.mode).toBe("idleWait");

    run(orbit, 200, position, target); // crosses the idle threshold
    expect(orbit.mode).toBe("blending");

    run(orbit, DEFAULT_BLEND_MS + 200, position, target);
    expect(orbit.mode).toBe("auto");
    expect(horizontalRadius(position, target)).toBeCloseTo(CAMERA.orbit.radius, 3);
    expect(target.toArray()).toEqual(CAMERA.target);
  });

  it("does not move the camera under prefers-reduced-motion (§5.3)", () => {
    const orbit = new AutoOrbitController(CAMERA, { reducedMotion: true });
    const position = new THREE.Vector3(...CAMERA.initialPosition);
    const target = new THREE.Vector3(...CAMERA.target);
    expect(orbit.update(5000, position, target)).toBe(false);
    expect(position.toArray()).toEqual(CAMERA.initialPosition);
  });
});
