/** query helper; legacy UI code treats results as HTML elements of any kind */
export const $ = (s: string, r: ParentNode = document): any => r.querySelector(s);
export const $$ = (s: string, r: ParentNode = document): any[] => Array.from(r.querySelectorAll(s));
export const numVal = (sel, root = document, def = 0) => { const el = typeof sel === 'string' ? $(sel, root) : sel; if (!el) return def; const v = parseFloat(String(el.value).replace(',', '.')); return isFinite(v) ? v : def; };
export function download(name, content, type = 'application/json') {
  const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
