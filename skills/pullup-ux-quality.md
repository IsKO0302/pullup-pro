---
name: pullup-ux-quality
description: Review and improve the UX, accessibility and mobile quality of PULLUP PRO screens (dashboard, workout mode, journal, stats, body, nutrition, settings, Telegram Mini App). Use when asked to audit, polish, simplify or fix usability of a screen or flow.
---

# PULLUP PRO — UX and quality checklist

## Product principles
- Not a library of exercises: plan -> do the workout -> save results -> see progress -> know the next step.
- **Home training first** (bodyweight, bar, dips, bands, backpack, water bottles); never require a gym.
- Honest data: demo data is labelled, nutrition values are "approximate", the coach is a set of rules (never call it AI), no medical claims, no body-fat estimate from photos, a "Pain" button always available in workouts.
- **Local-first:** everything works offline; the server is optional. Progress photos stay on the device unless the user separately consents.
- The app must never lose a user's history: no destructive action without a confirmation and an automatic snapshot.

## Audit a screen (answer each, fix what fails)
1. What is the one primary action? Is it the most prominent element and reachable with a thumb (bottom area on phones)?
2. First 3 seconds: can the user see today's mission / next workout / progress without scrolling?
3. Empty state: does it say what to do next and offer a working button?
4. Loading, error and offline states exist and are calm; nothing shows `NaN`, `undefined`, `[object Object]`.
5. Forms: correct input types (`inputmode`, `type=number`/`date`), sensible defaults, validation messages next to the field, Enter submits, nothing is lost on a mistake.
6. Workout mode: big tap targets, no accidental finish, rest timer visible, haptics/sound optional, resume after reload, screen stays on.
7. Lists and charts: readable at 320 px, one accent series, values on tap/hover, units always shown (kg, cm, s).
8. Copy: short, concrete, active voice; the same word for the same thing everywhere; every new string follows the skill `pullup-i18n`.

## Accessibility
- Every control reachable and visible on keyboard focus; labels via `aria-label`/`<label>`; dialogs trap focus and close with Escape.
- Contrast >= 4.5:1; do not rely on color alone (add icon or text for status).
- Respect `prefers-reduced-motion`; no flashing; text can scale to 200% without breaking layout.

## Telegram Mini App
- Honour `--tg-top` / `--tg-bottom` safe areas, the theme (`body.in-tg`), BackButton on inner screens, MainButton for the primary action (hidden while a dialog or workout is open), haptic feedback, closing confirmation during a workout.
- No `localStorage` assumptions beyond the Telegram WebView; remind the user to export data when sync is off.

## Performance
- Budget: JS bundle ~730 KB (217 KB gzip) today - do not grow it casually; no new heavy libraries; prefer CSS over JS for effects; lazy work on idle.
- Charts and figures must not block input; mobile devices get simpler effects.

## Done means
Typecheck, unit, e2e pass; screenshots at 360/390/768/1366 px were looked at; a short before/after list of what changed and why.
