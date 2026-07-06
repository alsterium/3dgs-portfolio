import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveAppUrl } from "../lib/assetUrl";
import { pickLocalized, toLang } from "../lib/localized";
import type { Scene } from "../lib/sceneSchema";
import { isWebGl2Supported, ViewerEngine, type ViewerStatus } from "./engine";

type SplatViewerProps = {
  scene: Scene;
  thumbnailMode?: boolean;
  onStatusChange?: (status: ViewerStatus) => void;
};

/**
 * React wrapper around ViewerEngine: mounts the canvas, forwards scene
 * selection, renders the loading overlay and the WebGL/load error fallbacks
 * (§5.2 — static thumbnail + message when WebGL is unavailable).
 */
export function SplatViewer({ scene, thumbnailMode = false, onStatusChange }: SplatViewerProps) {
  const { t, i18n } = useTranslation();
  const lang = toLang(i18n.resolvedLanguage);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ViewerEngine | null>(null);
  const [status, setStatus] = useState<ViewerStatus>({ phase: "idle" });
  const statusCallbackRef = useRef(onStatusChange);
  statusCallbackRef.current = onStatusChange;

  const supported = useMemo(() => isWebGl2Supported(), []);

  useEffect(() => {
    if (!supported || !containerRef.current) return;
    const engine = new ViewerEngine(containerRef.current, {
      thumbnailMode,
      onStatus: (s) => {
        setStatus(s);
        statusCallbackRef.current?.(s);
      },
    });
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, [supported, thumbnailMode]);

  useEffect(() => {
    void engineRef.current?.showScene(scene);
  }, [scene, supported, thumbnailMode]);

  if (!supported) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
        <img
          src={resolveAppUrl(scene.thumbnail)}
          alt={pickLocalized(scene.title, lang)}
          className="max-h-[60%] max-w-full border border-line object-contain"
        />
        <p className="max-w-md text-center text-sm leading-relaxed text-panel">
          {t("viewer.webglError")}
        </p>
      </div>
    );
  }

  const progress = status.phase === "loading" ? status.progress : null;
  const percent =
    progress?.fraction != null ? Math.min(99, Math.round(progress.fraction * 100)) : null;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />

      {status.phase === "loading" && (
        <>
          <div
            className="absolute top-0 left-0 z-20 h-0.5 bg-paper transition-[width] duration-150"
            style={{ width: percent != null ? `${percent}%` : "100%" }}
            data-indeterminate={percent == null || undefined}
          />
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-ink/55"
            role="status"
          >
            <span className="font-mono text-[13px] tracking-[0.2em] text-label">
              {t("viewer.loading")}
              {percent != null ? ` ${percent}%` : "…"}
            </span>
          </div>
        </>
      )}

      {status.phase === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-ink/70 p-8">
          <p className="max-w-md text-center text-sm leading-relaxed text-panel">
            {t("viewer.loadError")}
          </p>
          <button
            type="button"
            onClick={() => engineRef.current?.retry(scene)}
            className="cursor-pointer border border-line-strong px-4 py-1.5 text-xs text-label hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper"
          >
            {t("viewer.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
