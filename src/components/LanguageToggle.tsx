import { useTranslation } from "react-i18next";
import { type Lang, toLang } from "../lib/localized";

const LANGS: Lang[] = ["ja", "en"];

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const active = toLang(i18n.resolvedLanguage);

  return (
    <div
      role="group"
      aria-label={t("lang.toggleLabel")}
      className="flex overflow-hidden rounded-[2px] border border-line"
    >
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => void i18n.changeLanguage(lang)}
          aria-pressed={active === lang}
          className={`cursor-pointer px-4 py-1.5 font-mono text-[11px] tracking-[0.1em] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper ${
            active === lang ? "bg-paper text-ink" : "bg-transparent text-muted hover:text-label"
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
