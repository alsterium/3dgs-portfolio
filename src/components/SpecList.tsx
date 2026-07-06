import { useTranslation } from "react-i18next";
import { formatMegabytes, formatSplats } from "../lib/format";
import { type Lang, pickLocalized } from "../lib/localized";
import type { Scene } from "../lib/sceneSchema";

type SpecListProps = {
  scene: Scene;
  lang: Lang;
  dense?: boolean;
};

/** FR-14 metadata rows, shared by the desktop panel and the mobile sheet. */
export function SpecList({ scene, lang, dense = false }: SpecListProps) {
  const { t } = useTranslation();

  const rows: Array<{ label: string; value: string }> = [
    { label: t("panel.fileSize"), value: formatMegabytes(scene.fileSizeBytes) },
    ...(scene.numSplats != null
      ? [{ label: t("panel.splats"), value: formatSplats(scene.numSplats) }]
      : []),
    ...(scene.shDegree != null
      ? [{ label: t("panel.shDegree"), value: `SH${scene.shDegree}` }]
      : []),
    { label: t("panel.capturedAt"), value: scene.capturedAt },
    { label: t("panel.equipment"), value: pickLocalized(scene.equipment, lang) },
    { label: t("panel.pipeline"), value: pickLocalized(scene.pipeline, lang) },
  ];

  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`flex items-baseline justify-between gap-4 border-b border-line-soft ${
            dense ? "py-2" : "py-2.5"
          }`}
        >
          <dt className={`flex-none text-muted ${dense ? "text-[11px]" : "text-xs"}`}>
            {row.label}
          </dt>
          <dd className={`text-right font-mono text-paper ${dense ? "text-xs" : "text-[13px]"}`}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
