import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resolveAssetUrl } from "../lib/assetUrl";
import type { Scene } from "../lib/sceneSchema";
import { fetchWithProgress, LruCache, type ProgressInfo } from "./loader";
import { AutoOrbitController } from "./orbit";

export type ViewerStatus =
  | { phase: "idle" }
  | { phase: "loading"; progress: ProgressInfo | null }
  | { phase: "ready" }
  | { phase: "error"; reason: "load" };

export type ViewerEngineOptions = {
  onStatus?: (status: ViewerStatus) => void;
  /** Fixed camera + ready flag for the build-time thumbnail pipeline (§6.4). */
  thumbnailMode?: boolean;
};

/** FR-13: keep at most the current scene plus one previous scene in memory. */
const SCENE_CACHE_CAPACITY = 2;

const BACKGROUND_COLOR = 0x0b0c0e;

/** Base vertical field of view the scene cameras are framed for. */
const BASE_FOV = 50;
/**
 * Landscape aspect ratio the scene `radius`/`initialPosition` values are tuned
 * for. Viewports at least this wide use {@link BASE_FOV} unchanged.
 */
const REFERENCE_ASPECT = 1.6;
/** Ceiling on the widened FOV to keep perspective distortion in check. */
const MAX_FOV = 90;

/**
 * Adapt the vertical FOV to the viewport aspect so the subject stays framed at
 * an appropriate size on every screen. three.js FOV is vertical, so a narrow
 * (portrait) viewport otherwise shrinks the horizontal field of view and crops
 * the subject. For aspects below {@link REFERENCE_ASPECT} we widen the vertical
 * FOV enough to keep the horizontal coverage the scene was framed for.
 */
function fovForAspect(aspect: number): number {
  if (aspect >= REFERENCE_ASPECT) return BASE_FOV;
  const baseHalfTan = Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2);
  const widened = 2 * Math.atan((baseHalfTan * REFERENCE_ASPECT) / aspect);
  return Math.min(MAX_FOV, THREE.MathUtils.radToDeg(widened));
}

declare global {
  interface Window {
    __THUMB_READY?: boolean;
  }
}

function clampedPixelRatio(): number {
  // §5.1 — clamp devicePixelRatio to keep fill-rate manageable on mobile.
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function isWebGl2Supported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/**
 * Imperative three.js/Spark viewer. Owns the render loop, camera controls,
 * scene loading (abortable, with progress) and the small scene LRU cache.
 * React integration lives in SplatViewer.tsx.
 */
export class ViewerEngine {
  private readonly container: HTMLElement;
  private readonly onStatus?: (status: ViewerStatus) => void;
  private readonly thumbnailMode: boolean;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene3: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;

  private readonly meshCache = new LruCache<SplatMesh>(SCENE_CACHE_CAPACITY, (mesh) => {
    mesh.removeFromParent();
    mesh.dispose();
  });

  private currentMesh: SplatMesh | null = null;
  private currentSlug: string | null = null;
  private orbit: AutoOrbitController | null = null;
  private abortController: AbortController | null = null;
  private framesSinceReady = -1;
  private disposed = false;

  private readonly tmpPosition = new THREE.Vector3();
  private readonly tmpTarget = new THREE.Vector3();

  constructor(container: HTMLElement, options: ViewerEngineOptions = {}) {
    this.container = container;
    this.onStatus = options.onStatus;
    this.thumbnailMode = options.thumbnailMode ?? false;

    // Spark works best without MSAA (see SparkRendererOptions docs).
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(clampedPixelRatio());
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene3 = new THREE.Scene();
    this.scene3.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene3.add(new SparkRenderer({ renderer: this.renderer }));

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 1000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.addEventListener("start", () => this.orbit?.onInteractStart());
    this.controls.addEventListener("end", () => this.orbit?.onInteractEnd());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop(() => this.renderFrame());
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    this.renderer.setSize(width, height);
    this.camera.aspect = aspect;
    this.camera.fov = fovForAspect(aspect);
    this.camera.updateProjectionMatrix();
  }

  private renderFrame(): void {
    const dtMs = this.clock.getDelta() * 1000;

    if (this.orbit && !this.thumbnailMode) {
      this.tmpPosition.copy(this.camera.position);
      this.tmpTarget.copy(this.controls.target);
      if (this.orbit.update(dtMs, this.tmpPosition, this.tmpTarget)) {
        this.camera.position.copy(this.tmpPosition);
        this.controls.target.copy(this.tmpTarget);
        this.camera.lookAt(this.tmpTarget);
      } else {
        this.controls.update();
      }
    } else {
      this.controls.update();
    }

    this.renderer.render(this.scene3, this.camera);

    if (this.thumbnailMode && this.framesSinceReady >= 0) {
      this.framesSinceReady += 1;
      // Give the sorter a few frames to settle before signalling readiness.
      if (this.framesSinceReady >= 5) window.__THUMB_READY = true;
    }
  }

  private setStatus(status: ViewerStatus): void {
    if (!this.disposed) this.onStatus?.(status);
  }

  private applyCameraForScene(scene: Scene): void {
    const { camera } = scene;
    this.controls.minDistance = camera.limits.minDistance;
    this.controls.maxDistance = camera.limits.maxDistance;
    this.controls.target.set(...camera.target);
    this.camera.position.set(...camera.initialPosition);
    this.camera.lookAt(this.controls.target);
    this.orbit = this.thumbnailMode
      ? null
      : new AutoOrbitController(camera, { reducedMotion: prefersReducedMotion() });
  }

  private attachMesh(scene: Scene, mesh: SplatMesh): void {
    if (this.currentMesh && this.currentMesh !== mesh) {
      // Detach but keep in cache — FR-13 allows the previous scene to stay
      // resident so switching back is instant.
      this.currentMesh.removeFromParent();
    }
    this.currentMesh = mesh;
    this.currentSlug = scene.slug;
    // 3DGS assets use the y-down splat convention; flip 180° about X so the
    // scene is upright in three.js's y-up world (same as the Spark examples).
    mesh.quaternion.set(1, 0, 0, 0);
    this.scene3.add(mesh);
    this.applyCameraForScene(scene);
    this.framesSinceReady = 0;
    this.setStatus({ phase: "ready" });
  }

  /**
   * Select a scene: abort any in-flight load (FR-12), then either reuse the
   * cached mesh or download the asset with progress reporting (FR-10/11).
   */
  async showScene(scene: Scene): Promise<void> {
    if (this.disposed) return;

    // Always cancel whatever is in flight first (FR-12) — including when the
    // user switches back to the already-attached scene while another load is
    // still downloading.
    this.abortController?.abort();
    if (scene.slug === this.currentSlug) {
      this.setStatus({ phase: "ready" });
      return;
    }
    const abort = new AbortController();
    this.abortController = abort;

    const cached = this.meshCache.get(scene.slug);
    if (cached) {
      this.attachMesh(scene, cached);
      return;
    }

    this.setStatus({ phase: "loading", progress: null });
    try {
      const bytes = await fetchWithProgress(resolveAssetUrl(scene.asset), {
        signal: abort.signal,
        onProgress: (progress) => {
          if (!abort.signal.aborted) this.setStatus({ phase: "loading", progress });
        },
      });

      const mesh = new SplatMesh({ fileBytes: bytes, fileName: scene.asset });
      await mesh.initialized;

      if (abort.signal.aborted || this.disposed) {
        mesh.dispose();
        return;
      }

      this.meshCache.set(scene.slug, mesh);
      this.attachMesh(scene, mesh);
    } catch (error) {
      if (abort.signal.aborted || this.disposed) return; // superseded selection
      console.error("Failed to load scene asset", error);
      this.setStatus({ phase: "error", reason: "load" });
    }
  }

  /** Re-attempt loading the current selection after a load error. */
  retry(scene: Scene): void {
    this.currentSlug = null;
    void this.showScene(scene);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController?.abort();
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.currentMesh?.removeFromParent();
    this.currentMesh = null;
    this.meshCache.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
