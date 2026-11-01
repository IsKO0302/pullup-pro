/* ================= Current interface language (shared by web, bot and the formatting helpers) =================
 * Russian is the source language of every string in the code base; English and Turkish are provided by dictionaries
 * (see en.ts / tr.ts and translate.ts). Formatting helpers (dates, plural forms, numbers) read the language from here. */
export type Lang = 'ru' | 'en' | 'tr';
export const LANGS: readonly Lang[] = ['ru', 'en', 'tr'];
export const LANG_NAME: Readonly<Record<Lang, string>> = { ru: 'Русский', en: 'English', tr: 'Türkçe' };
const NUM_LOCALE: Readonly<Record<Lang, string>> = { ru: 'ru-RU', en: 'en-US', tr: 'tr-TR' };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
/** maps a BCP-47 / Telegram language_code ("en-GB", "tr", "ru") to a supported language, or null */
export function langFromCode(code: unknown): Lang | null {
  const c = String(code || '').toLowerCase().slice(0, 2);
  return isLang(c) ? c : null;
}

let current: Lang = 'ru';
const listeners: Array<(l: Lang) => void> = [];
export const getLang = (): Lang => current;
export const numLocale = (): string => NUM_LOCALE[current];
/** helpers with language-dependent tables register here to be switched in place */
export const onLangChange = (fn: (l: Lang) => void): void => { listeners.push(fn); fn(current); };
export function setLang(l: Lang): void {
  current = l;
  for (const fn of listeners) fn(l);
}
