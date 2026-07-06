import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Lang, pickLocalized } from "../lib/localized";
import type { Scene } from "../lib/sceneSchema";
import { SpecList } from "./SpecList";

type MetadataPanelProps = {
  scene: Scene;
  lang: Lang;
};

/** Desktop right-hand SPECS panel (FR-14/15), collapsible per the 1a mock. */
export function MetadataPanel({ scene, lang }: MetadataPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <aside className="pointer-events-auto flex w-[312px] flex-col">
      <div className="flex items-center justify-between border-b border-line-strong pb-3">
        <span className="font-mono text-[11px] tracking-[0.24em] text-muted">
          {t("panel.specs")}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="cursor-pointer whitespace-nowrap rounded-[2px] border border-line-strong px-3 py-1 text-[11px] text-label hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper"
        >
          {open ? t("panel.hide") : t("panel.show")}
        </button>
      </div>
      {open && (
        <div className="min-h-0 overflow-y-auto">
          <p className="my-4 text-[13px] leading-[1.8] text-panel">
            {pickLocalized(scene.description, lang)}
          </p>
          <SpecList scene={scene} lang={lang} />
        </div>
      )}
    </aside>
  );
}

/** Mobile title row + collapsible details sheet (FR-15). */
export function MobileDetails({ scene, lang }: MetadataPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-5 pt-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 truncate font-mono text-[10px] tracking-[0.14em] text-muted">
            {pickLocalized(scene.title, lang === "ja" ? "en" : "ja")}
          </div>
          <h1 className="text-[22px] font-bold leading-tight">
            {pickLocalized(scene.title, lang)}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-8 flex-none cursor-pointer whitespace-nowrap rounded-[2px] border border-line-strong px-3.5 py-1.5 text-[11px] text-label focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper"
        >
          {open ? t("panel.hide") : t("panel.details")}
        </button>
      </div>
      {open && (
        <div className="mt-3 max-h-[32dvh] overflow-y-auto border-t border-line-strong">
          <p className="mt-3 mb-1 text-xs leading-[1.7] text-panel">
            {pickLocalized(scene.description, lang)}
          </p>
          <SpecList scene={scene} lang={lang} dense />
        </div>
      )}
    </div>
  );
}
