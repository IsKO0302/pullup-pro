---
name: pullup-i18n
description: Add or change any user-visible text in PULLUP PRO (web app, Telegram bot) while keeping Russian, English and Turkish working. Use whenever text, labels, messages, tips, exercise descriptions or dates are added, renamed or rewritten, and when a new language is requested.
---

# PULLUP PRO — translations (RU source, EN, TR)

## How it works
- **Russian is the source language of every string in the code.** English and Turkish are dictionaries "exact Russian string -> translation" in `packages/shared/src/i18n/en-N.ts` and `tr-N.ts` (parts 1-8, merged by `en.ts` / `tr.ts`).
- The web app translates the DOM live (`apps/web/src/core/i18n.ts`): text nodes plus `placeholder`, `title`, `aria-label`, `alt` and the page title. A string without a translation stays Russian (never blank).
- Dates, numbers and plural forms come from the shared helpers (`util.ts`, `dates.ts`) which follow the current language; do not hard-code month names, `toLocaleString('ru-RU')` or plural arrays when a helper exists (`pl(n, W.set)`, `fmtDay`, `fmtNum`, `numLocale()`).
- The Telegram bot answers in the Telegram user's language (`apps/telegram-bot/src/texts.ts`: `localized`, `inLang`, `loc`).
- Language choice: Settings -> "Language / Язык / Dil", stored in `localStorage['pullup.lang']`; default from the browser or Telegram.

## Rules
1. **Changing a Russian sentence in code breaks its translations.** The key is the exact text. If you reword it, add the new key to the dictionaries (EN and TR) in the same change. Prefer not to reword.
2. **Placeholders.** Numbers inside text are written as `{a}`..`{h}` in the dictionary key and may be moved in the translation ("Set {a} of {b}"); each placeholder must appear in both the key and the translation (the unit test checks it). `{x}`, `{y}`... capture a whole phrase.
3. **Never concatenate half-sentences** from several translatable pieces if the word order differs between languages; use one sentence with placeholders.
4. **Turkish:** no plural after a number ("5 set"), keep gym terms people actually use (dips, deload, face pull, false grip), use apostrophes only before suffixes ("%{b}'inde"). Have a native speaker review.
5. Where to add: new keys go into `en-8.ts` and `tr-8.ts` (or a new part imported by `en.ts`/`tr.ts`). Keys and values are plain strings; no Cyrillic in a translation.
6. Do not translate user data (names, notes, food names) and the language names in the switcher.

## Check
```
npm run test:unit                      # dictionaries: placeholders match, no Cyrillic in translations
npm run dev
node tests/qa/i18n-coverage.mjs http://localhost:5173/ en out-en.json   # Russian left on screens in EN (also tr)
npm run test:e2e                       # i18n.spec.ts: 20 screens and catalog pages have no Russian left
```
A new screen must be added to `MAIN_SCREENS` in `tests/e2e/i18n.spec.ts` and to the crawl list in `tests/qa/i18n-coverage.mjs`.
