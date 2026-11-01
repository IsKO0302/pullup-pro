import { EN } from '@pullup/shared/i18n/en';
import { TR } from '@pullup/shared/i18n/tr';
import { getLang, isLang, langFromCode, setLang, type Lang } from '@pullup/shared/i18n/locale';
import { makeTranslator, type Translator } from '@pullup/shared/i18n/translate';

/* ================= Interface language: Russian (source) / English / Turkish =================
 * The code base is written in Russian; for English and Turkish every text node and the text attributes of the page are
 * translated through the dictionaries (packages/shared/src/i18n) as they appear in the DOM — including dialogs, toasts and
 * the document title. A string without a translation stays in Russian. The choice is stored on the device ("pullup.lang"). */
const KEY = 'pullup.lang';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
const CYR = /[А-Яа-яЁё]/;
let tr: Translator | null = null;
let observer: MutationObserver | null = null;

function stored(): Lang | null { try { const v = localStorage.getItem(KEY); return isLang(v) ? v : null; } catch (e) { return null; } }
/** explicit choice → Telegram language → browser language → Russian */
export function detectLang(telegramCode?: string): Lang {
  return stored() || langFromCode(telegramCode) || langFromCode(typeof navigator !== 'undefined' ? navigator.language : '') || 'ru';
}
/** translate one string of the source language (for texts built outside the DOM, e.g. file names or native dialogs) */
export const t = (s: string): string => (tr ? tr(s) : s);

function fixNode(n: Node): void {
  if (!tr) return;
  if (n.nodeType === 3) {
    const v = n.nodeValue;
    if (v && CYR.test(v)) { const o = tr(v); if (o !== v) n.nodeValue = o; }
    return;
  }
  if (n.nodeType !== 1) return;
  const el = n as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  for (const a of ATTRS) { const v = el.getAttribute(a); if (v && CYR.test(v)) { const o = tr(v); if (o !== v) el.setAttribute(a, o); } }
  if (SKIP.has(el.tagName)) return;                          // attributes (placeholder…) are translated, the content of these tags is not
  for (let c = el.firstChild; c; c = c.nextSibling) fixNode(c);
}
function onMutations(records: MutationRecord[]): void {
  for (const r of records) {
    if (r.type === 'childList') r.addedNodes.forEach(fixNode);
    else if (r.type === 'characterData') fixNode(r.target);
    else if (r.type === 'attributes' && r.target.nodeType === 1) fixNode(r.target);
  }
  observer?.takeRecords();                                   // drop the records caused by our own edits
}

/** call once before the first render; telegramCode is only a UI-language hint, never an identity */
export function initI18n(telegramCode?: string): Lang {
  const lang = detectLang(telegramCode);
  setLang(lang);
  document.documentElement.lang = lang;
  tr = lang === 'en' ? makeTranslator(EN) : lang === 'tr' ? makeTranslator(TR) : null;
  if (tr && !observer) {
    fixNode(document.documentElement);
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  return lang;
}
/** remember the choice and rebuild the interface from the source texts */
export function chooseLang(l: Lang): void {
  if (!isLang(l) || l === getLang()) return;
  try { localStorage.setItem(KEY, l); } catch (e) { /* storage blocked: the choice lasts until reload only */ }
  location.reload();
}
