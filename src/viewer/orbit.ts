import * as THREE from "three";
import type { SceneCamera } from "../lib/sceneSchema";

export const DEFAULT_IDLE_RESUME_MS = 5000;
export const DEFAULT_BLEND_MS = 1800;

export type OrbitMode = "auto" | "interacting" | "idleWait" | "blending";

type OrbitOptions = {
  idleResumeMs?: number;
  blendMs?: number;
  /** When true the auto-orbit never moves the camera (prefers-reduced-motion). */
  reducedMotion?: boolean;
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Drives the FR-2/FR-3/FR-4 camera behaviour:
 * - auto-orbits around the scene-defined target at the scene-defined
 *   radius/height/speed,
 * - pauses while the user interacts,
 * - after `idleResumeMs` of inactivity, smoothly blends from wherever the
 *   user left the camera back onto the orbit trajectory.
 *
 * The controller is renderer-agnostic: `update` mutates the vectors it is
 * given and reports whether it moved them, which keeps it unit-testable.
 */
export class AutoOrbitController {
  private readonly target: THREE.Vector3;
  private readonly radius: number;
  private readonly height: number;
  private readonly speedRadPerSec: number;
  private readonly idleResumeMs: number;
  private readonly blendMs: number;
  private readonly reducedMotion: boolean;

  private currentMode: OrbitMode;
  private azimuth = 0;
  private idleRemainingMs = 0;
  private blendT = 1;
  private fromRadius = 0;
  private fromHeight = 0;
  private readonly fromTarget = new THREE.Vector3();

  constructor(camera: SceneCamera, options: OrbitOptions = {}) {
    this.target = new THREE.Vector3(...camera.target);
    this.radius = camera.orbit.radius;
    this.height = camera.orbit.height;
    this.speedRadPerSec = THREE.MathUtils.degToRad(camera.orbit.speedDegPerSec);
    this.idleResumeMs = options.idleResumeMs ?? camera.idleResumeMs ?? DEFAULT_IDLE_RESUME_MS;
    this.blendMs = options.blendMs ?? DEFAULT_BLEND_MS;
    this.reducedMotion = options.reducedMotion ?? false;

    // Ease in from the scene-defined initial pose onto the orbit trajectory.
    const initial = new THREE.Vector3(...camera.initialPosition);
    this.currentMode = "blending";
    this.beginBlend(initial, this.target.clone());
  }

  get mode(): OrbitMode {
    return this.currentMode;
  }

  onInteractStart(): void {
    this.currentMode = "interacting";
  }

  onInteractEnd(): void {
    if (this.currentMode !== "interacting") return;
    this.currentMode = "idleWait";
    this.idleRemainingMs = this.idleResumeMs;
  }

  private beginBlend(cameraPosition: THREE.Vector3, controlsTarget: THREE.Vector3): void {
    const offset = cameraPosition.clone().sub(controlsTarget);
    this.azimuth = Math.atan2(offset.z, offset.x);
    this.fromRadius = Math.hypot(offset.x, offset.z);
    this.fromHeight = offset.y;
    this.fromTarget.copy(controlsTarget);
    this.blendT = 0;
    this.currentMode = "blending";
  }

  private orbitOffsetInto(out: THREE.Vector3, radius: number, height: number): void {
    out.set(radius * Math.cos(this.azimuth), height, radius * Math.sin(this.azimuth));
  }

  /**
   * Advance the controller. Writes the desired camera position and controls
   * target into the given vectors and returns true when it did so; returns
   * false while the user is in control (or motion is reduced).
   */
  update(dtMs: number, cameraPosition: THREE.Vector3, controlsTarget: THREE.Vector3): boolean {
    if (this.reducedMotion) return false;

    switch (this.currentMode) {
      case "interacting":
        return false;
      case "idleWait": {
        this.idleRemainingMs -= dtMs;
        if (this.idleRemainingMs > 0) return false;
        this.beginBlend(cameraPosition, controlsTarget);
        return this.update(0, cameraPosition, controlsTarget);
      }
      case "blending": {
        this.azimuth += this.speedRadPerSec * (dtMs / 1000);
        this.blendT = Math.min(1, this.blendT + (this.blendMs === 0 ? 1 : dtMs / this.blendMs));
        const k = easeInOutCubic(this.blendT);
        const radius = THREE.MathUtils.lerp(this.fromRadius, this.radius, k);
        const height = THREE.MathUtils.lerp(this.fromHeight, this.height, k);
        controlsTarget.lerpVectors(this.fromTarget, this.target, k);
        this.orbitOffsetInto(cameraPosition, radius, height);
        cameraPosition.add(controlsTarget);
        if (this.blendT >= 1) this.currentMode = "auto";
        return true;
      }
      case "auto": {
        this.azimuth += this.speedRadPerSec * (dtMs / 1000);
        controlsTarget.copy(this.target);
        this.orbitOffsetInto(cameraPosition, this.radius, this.height);
        cameraPosition.add(this.target);
        return true;
      }
    }
  }
}
