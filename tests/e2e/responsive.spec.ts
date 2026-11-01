import type { Page } from '@playwright/test';
import { test, expect, onboard, go } from './fixtures';

/* Responsive layout: every main screen at 320 / 360 / 390 / 430 / 768 / 1024 / 1366 / 1920 px with the labelled demo
 * history loaded (charts, tables and lists filled). Checks: no page-level horizontal scroll, no element of the
 * screen sticking out of the viewport or out of its card (except inside intentional horizontal scrollers / clipping containers),
 * no broken values (NaN, undefined, [object Object]) in the visible text. */
const SIZES: [number, number][] = [[320, 640], [360, 780], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 900], [1920, 1080]];
const ROUTES = ['home', 'train', 'plan', 'programs', 'mu', 'library', 'library/pullup', 'journal', 'stats', 'body', 'body/photos', 'nutrition',
  'calendar', 'builder', 'builder/new', 'profile', 'achievements', 'report', 'settings'];

async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out: string[] = [];
    if (document.documentElement.scrollWidth > vw) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    const contained = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { const r = p.getBoundingClientRect(); if (r.left >= -1 && r.right <= vw + 1) return true; }
      }
      return false;
    };
    for (const el of Array.from(document.querySelectorAll('#view *'))) {
      const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'contents') continue;
      if ((r.right > vw + 1 || r.left < -1) && !contained(el)) {
        out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String((el as HTMLElement).className || '').split(' ').filter(Boolean).join('.')} [${Math.round(r.left)}..${Math.round(r.right)}] > ${vw}`);
        if (out.length > 4) break;
      }
    }
    // content must also stay inside its card / KPI tile (a button or badge sticking out of the card is a layout bug
    // even when the page itself does not scroll); decorations (absolute) and inner scrollers are allowed
    for (const card of Array.from(document.querySelectorAll('#view .card, #view .kpi'))) {
      const c = card.getBoundingClientRect(); if (c.width <= 1 || out.length > 4) continue;
      for (const el of Array.from(card.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;
        const cs = getComputedStyle(el); if (cs.position === 'absolute' || cs.position === 'fixed' || cs.visibility === 'hidden') continue;
        if (r.right <= c.right + 1 && r.left >= c.left - 1) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== card; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
        if (clipped) continue;
        out.push(`out of card: ${el.tagName.toLowerCase()}.${String((el as HTMLElement).className || '').split(' ').filter(Boolean).join('.')} «${(el.textContent || '').trim().slice(0, 30)}» [${Math.round(r.left)}..${Math.round(r.right)}] card [${Math.round(c.left)}..${Math.round(c.right)}]`);
        break;
      }
    }
    return out;
  });
}

for (const [w, h] of SIZES) {
  test(`responsive ${w}×${h}: no overflow on ${ROUTES.length} screens`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await onboard(page, { demo: true });
    for (const r of ROUTES) {
      await go(page, `#/${r}`);
      await expect(page.locator('#view')).not.toBeEmpty();
      await page.waitForTimeout(120);                                             // charts are drawn after render
      expect(await overflow(page), `#/${r} at ${w}px`).toEqual([]);
      const text = await page.locator('#view').innerText();
      expect(text, `#/${r} at ${w}px`).not.toMatch(/\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/);
    }
  });
}
