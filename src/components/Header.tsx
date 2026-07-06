import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./LanguageToggle";

export function Header() {
  const { t } = useTranslation();
  return (
    <header className="relative z-40 flex items-center justify-between px-5 py-4 md:px-8 md:py-5">
      <div className="font-mono text-[10px] tracking-[0.28em] text-muted md:text-xs">
        {t("app.title")}
      </div>
      <LanguageToggle />
    </header>
  );
}
