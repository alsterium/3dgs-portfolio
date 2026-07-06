import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { resolveAppUrl } from "../lib/assetUrl";
import { type Lang, pickLocalized } from "../lib/localized";
import type { Scene } from "../lib/sceneSchema";

type CarouselProps = {
  scenes: Scene[];
  selectedSlug: string;
  lang: Lang;
  onSelect: (slug: string) => void;
};

const CLICK_SUPPRESS_MS = 150;

/**
 * Scene selector rail (FR-6..FR-9). Selection inputs supported here:
 * click/tap, mouse drag-to-scroll, native touch swipe and the arrow buttons.
 * ←/→ keyboard handling is global (see PortfolioPage). Thumbnails use
 * loading="lazy" so 30+ scenes stay cheap (FR-9).
 */
export function Carousel({ scenes, selectedSlug, lang, onSelect }: CarouselProps) {
  const { t } = useTranslation();
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);

  const selectedIndex = Math.max(
    0,
    scenes.findIndex((s) => s.slug === selectedSlug),
  );

  const step = (delta: number) => {
    const next = (selectedIndex + delta + scenes.length) % scenes.length;
    onSelect(scenes[next].slug);
  };

  // FR-8: keep the selected thumbnail centred in the rail.
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.children[selectedIndex] as HTMLElement | undefined;
    if (!rail || !item) return;
    const max = rail.scrollWidth - rail.clientWidth;
    const left = Math.max(
      0,
      Math.min(max, item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2),
    );
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    rail.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  }, [selectedIndex, scenes.length]);

  // Mouse drag-to-scroll; touch devices use native overflow scrolling.
  // Pointer capture is deferred until the drag threshold is crossed: capturing
  // on pointerdown would retarget the subsequent click to the rail, so a plain
  // click on a thumbnail would never reach its button (FR-7).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !railRef.current) return;
    dragRef.current = {
      startX: e.clientX,
      startScroll: railRef.current.scrollLeft,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const rail = railRef.current;
    if (!drag || !rail) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (drag.moved) rail.scrollLeft = drag.startScroll - dx;
  };
  const onPointerUp = () => {
    if (dragRef.current?.moved) {
      suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
    }
    dragRef.current = null;
  };

  return (
    <nav
      aria-label={t("carousel.label")}
      className="relative z-30 flex h-[118px] items-center gap-2.5 border-t border-line-soft bg-black/55 px-3 md:h-[152px] md:gap-3.5 md:px-5"
    >
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={t("carousel.prev")}
        className="hidden h-9 w-9 flex-none cursor-pointer rounded-[2px] border border-line text-[15px] text-label hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper md:block"
      >
        ‹
      </button>

      <div
        ref={railRef}
        role="listbox"
        aria-label={t("carousel.label")}
        aria-activedescendant={`scene-thumb-${selectedSlug}`}
        aria-orientation="horizontal"
        className="rail-scroll flex flex-1 cursor-grab touch-pan-x select-none gap-2.5 overflow-x-auto md:gap-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {scenes.map((scene, i) => {
          const selected = scene.slug === selectedSlug;
          const title = pickLocalized(scene.title, lang);
          return (
            <button
              key={scene.slug}
              id={`scene-thumb-${scene.slug}`}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                if (Date.now() < suppressClickUntilRef.current) return;
                onSelect(scene.slug);
              }}
              className={`w-[108px] flex-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper md:w-[168px] ${
                selected ? "opacity-100" : "opacity-55 hover:opacity-80"
              }`}
            >
              <span
                className={`relative block h-[60px] overflow-hidden border bg-thumb md:h-[86px] ${
                  selected ? "border-paper" : "border-thumb-line"
                }`}
              >
                <img
                  src={resolveAppUrl(scene.thumbnail)}
                  alt={title}
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                <span className="absolute top-1 left-1.5 font-mono text-[9px] text-faint md:text-[10px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </span>
              <span className="mt-1.5 block overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10px] text-label md:text-xs">
                {title}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        aria-label={t("carousel.next")}
        className="hidden h-9 w-9 flex-none cursor-pointer rounded-[2px] border border-line text-[15px] text-label hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper md:block"
      >
        ›
      </button>
    </nav>
  );
}
