import type { LocalizedText } from "./sceneSchema";

export type Lang = "ja" | "en";

/** Normalize an i18next language code ("ja-JP", "en-US", …) to a supported Lang. */
export function toLang(lng: string | undefined): Lang {
  return lng?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function otherLang(lang: Lang): Lang {
  return lang === "ja" ? "en" : "ja";
}

export function pickLocalized(text: LocalizedText, lang: Lang): string {
  return text[lang];
}
