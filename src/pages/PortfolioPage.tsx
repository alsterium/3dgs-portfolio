import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Carousel } from "../components/Carousel";
import { Header } from "../components/Header";
import { MetadataPanel, MobileDetails } from "../components/MetadataPanel";
import { otherLang, pickLocalized, toLang } from "../lib/localized";
import type { Scene } from "../lib/sceneSchema";
import { useScenesQuery } from "../lib/scenes";

// three.js + Spark are by far the heaviest dependencies; splitting them out
// keeps the UI shell within the §5.1 LCP budget.
const SplatViewer = lazy(() =>
  import("../viewer/SplatViewer").then((m) => ({ default: m.SplatViewer })),
);

export function PortfolioPage() {
  const { t, i18n } = useTranslation();
  const lang = toLang(i18n.resolvedLanguage);
  const { data, isPending, isError } = useScenesQuery();
  const params = useParams({ strict: false }) as { slug?: string };
  const search = useSearch({ strict: false }) as { thumb?: number };
  const navigate = useNavigate();

  const scenes = data?.scenes;
  const selected: Scene | undefined = scenes?.find((s) => s.slug === params.slug) ?? scenes?.[0];

  const select = useCallback(
    (slug: string) => {
      void navigate({ to: "/scene/$slug", params: { slug } });
    },
    [navigate],
  );

  // FR-7: global ←/→ scene switching.
  useEffect(() => {
    if (!scenes || !selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const delta = e.key === "ArrowLeft" ? -1 : 1;
      const index = scenes.findIndex((s) => s.slug === selected.slug);
      const next = (index + delta + scenes.length) % scenes.length;
      select(scenes[next].slug);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scenes, selected, select]);

  if (isPending) {
    return <CenterNote text={t("manifest.loading")} />;
  }
  if (isError || !scenes || !selected) {
    return <CenterNote text={t("manifest.error")} />;
  }

  // Build-time thumbnail rendering mode (§6.4): canvas only, fixed camera.
  if (search.thumb === 1) {
    return (
      <div className="relative h-dvh">
        <Suspense fallback={null}>
          <SplatViewer scene={selected} thumbnailMode />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header />

      <main className="relative min-h-0 flex-1">
        <Suspense fallback={null}>
          <SplatViewer scene={selected} />
        </Suspense>

        {/* Desktop: title bottom-left + SPECS panel on the right (overlay). */}
        <div className="pointer-events-none absolute bottom-9 left-12 z-10 hidden max-w-[520px] md:block">
          <div className="mb-2.5 font-mono text-xs tracking-[0.16em] text-muted">
            {pickLocalized(selected.title, otherLang(lang))}
          </div>
          <h1 className="text-[42px] font-bold leading-[1.15]">
            {pickLocalized(selected.title, lang)}
          </h1>
          <div className="mt-3 font-mono text-[11px] text-fainter">{t("viewer.orbitHint")}</div>
        </div>
        <div className="pointer-events-none absolute top-6 right-11 bottom-7 z-10 hidden md:flex">
          <MetadataPanel scene={selected} lang={lang} />
        </div>
      </main>

      {/* Mobile: title + collapsible details in flow, above the carousel. */}
      <div className="md:hidden">
        <MobileDetails scene={selected} lang={lang} />
        <div className="px-5 pt-1 pb-2 font-mono text-[10px] text-fainter">
          {t("viewer.orbitHintShort")}
        </div>
      </div>

      <Carousel scenes={scenes} selectedSlug={selected.slug} lang={lang} onSelect={select} />
    </div>
  );
}

function CenterNote({ text }: { text: string }) {
  return (
    <div className="flex h-dvh items-center justify-center">
      <span className="font-mono text-[13px] tracking-[0.2em] text-label">{text}</span>
    </div>
  );
}
