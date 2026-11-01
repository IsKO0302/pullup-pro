---
name: pullup-design-system
description: Redesign or restyle the PULLUP PRO web app (apps/web) without breaking it. Use for any visual change - colors, typography, cards, spacing, themes, animations, charts - or when asked to make the app look better, more premium or different.
---

# PULLUP PRO — visual design rules

## Product feel
A premium, athletic, personal training app: confident, calm, fast. Slogan: POWER. DISCIPLINE. PROGRESS. The owner profile is ISA PERSONAL, but the app serves many accounts. Never copy generic "AI dashboard" looks: one clear idea, strong hierarchy, generous space, real content (no lorem ipsum, no fake numbers).

## Where styles live (change here, not in markup)
- `apps/web/src/styles/app.css` (base, layout, components) and `v2.css` (2.0 additions).
- Theme is switched by classes on `<body>`: `light` (otherwise dark) and `acc-red`; the accent is driven by CSS variables `--acc`, `--acc2`, `--accRGB` (see `apps/web/src/core/theme.ts`). Before adding a color, grep the existing custom properties and reuse them.
- Screens are string templates in `apps/web/src/features/*`; shared pieces are in `src/components/*`.

## Rules
1. **Tokens first.** Put every color, radius, shadow, spacing step and font size into CSS custom properties on `:root` / `body.light`; components use only tokens. A new style must work by changing tokens plus a few component rules.
2. **Both themes.** Every change is checked in dark and light and in the Telegram theme (`body.in-tg`). Contrast text/background >= 4.5:1, large text and icons >= 3:1.
3. **Brand colors** (keep unless the owner asks otherwise): black, graphite, white, Orange Fire, Red Power.
4. **Type scale.** One display face for headings, one text face; at most 5 sizes; numbers in tabular figures for stats and timers.
5. **Cards and density.** One card style, one radius family, shadows sparing. KPI tiles show one number, a short label and a delta.
6. **Motion.** 120-250 ms ease-out for UI, longer only for the exercise figures. Respect `prefers-reduced-motion`. On phones simplify heavy effects (blur, large shadows, parallax).
7. **Charts.** Few series, direct labels, accent for the metric that matters, muted grey for context, readable on 320 px. Keep the demo/empty states labelled.
8. **Empty, loading, error states** are designed, never blank. Every button does something.
9. **Do not use random photos instead of technique.** The SVG exercise figures (`components/figure.ts`) are the product's teaching tool; restyle them via tokens, do not replace them.
10. **Mobile first.** Check 360, 390, 430, 768, 1024, 1366, 1920 px. Touch targets >= 44 px. In Telegram respect safe areas (`--tg-top`, `--tg-bottom`) and the BackButton/MainButton.

## Never change
- `data-act`, `data-tr`, `data-ob`, `data-pk`, `data-inp`, `data-chg`, element ids and the DOM structure that handlers and e2e tests use, unless you update both.
- Visible Russian strings (they are translation keys) - see the skill `pullup-i18n`.

## Done means
`npm run typecheck`, `npm run test:unit`, `npm run test:e2e` pass (responsive spec checks 8 widths x 19 screens), and `node tests/qa/gallery.mjs http://localhost:5173/ docs/screenshots` shows no issues. Look at the screenshots yourself.
