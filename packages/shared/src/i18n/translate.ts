/* ================= Translation engine (pure, no DOM) =================
 * A dictionary maps a Russian source string to its translation. Keys may contain {placeholders}
 * ("Подход {n} из {m}" → "Set {n} of {m}"); captured parts are translated recursively, so
 * "последняя: {x}" also handles "последняя: сегодня". Fallbacks when no entry matches the whole string:
 *   1. "a · b · c" lists are translated part by part;
 *   2. a leading number keeps its place ("12 подходов" → "12 " + translation of "подходов").
 * Unknown strings are returned unchanged, so a missing translation shows the Russian source instead of nothing. */
export type Dict = Readonly<Record<string, string>>;
export type Translator = (s: string) => string;

const WS = /\s+/g;
export const normalize = (s: string): string => s.replace(WS, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HOLE = /\{([a-z]+)\}/g;
const LEAD_NUM = /^([+\-−]?\d[\d.,:/×]*)\s+(\D.*)$/;

interface Pattern { re: RegExp; names: string[]; out: string }

export function makeTranslator(dict: Dict): Translator {
  const patterns: Pattern[] = Object.keys(dict).filter(k => k.includes('{')).sort((a, b) => b.length - a.length).map(k => {
    const names: string[] = [];
    // {a}…{h} stand for ONE short token (a number, a month name, a unit word); any other name captures a whole phrase
    const src = esc(k).replace(/\\\{([a-z]+)\\\}/g, (_m, n: string) => { names.push(n); return /^[a-h]$/.test(n) ? '([^\\sА-Яа-яЁё]{1,16})' : '(.+?)'; });
    return { re: new RegExp('^' + src + '$'), names, out: dict[k] };
  });
  const cache = new Map<string, string>();
  let phraseRe: RegExp | null = null;
  let numeric: { re: RegExp; out: string }[] | null = null;

  const core = (s: string, depth: number): string => {
    if (!s) return s;
    const hit = dict[s];
    if (hit !== undefined && !s.includes('{')) return hit;
    for (const p of patterns) {
      const m = p.re.exec(s); if (!m) continue;
      const vars: Record<string, string> = {}; p.names.forEach((n, i) => { vars[n] = depth < 4 ? core(m[i + 1], depth + 1) : m[i + 1]; });
      return p.out.replace(HOLE, (_x, n: string) => vars[n] ?? '');
    }
    if (depth < 4) {
      // glued text ("Вес: 78,5 кг", several sentences, a line with a date): replace every known phrase, keep numbers and
      // punctuation — accepted only when no Russian is left, so the result is never a half-translated sentence
      phraseRe ??= new RegExp('(?<![А-Яа-яЁёA-Za-z])(?:' + Object.keys(dict).filter(k => !k.includes('{') && /[А-Яа-яЁё]/.test(k)).sort((a, b) => b.length - a.length).map(esc).join('|') + ')(?![А-Яа-яЁё])', 'g');
      numeric ??= Object.keys(dict).filter(k => /\{[a-h]\}/.test(k) && !/\{[i-z]/.test(k) && /[А-Яа-яЁё]/.test(k)).sort((a, b) => b.length - a.length).map(k => {
        const body = esc(k).replace(/\\\{([a-h])\\\}/g, '(?<$1>[^\\sА-Яа-яЁё]{1,16})');   // numbers, month names and units: one token without Russian letters
        return { re: new RegExp('(?<![А-Яа-яЁёA-Za-z])' + body + '(?![А-Яа-яЁё])', 'g'), out: dict[k] };
      });
      let glued = s;
      for (const p of numeric) glued = glued.replace(p.re, (...a) => { const g = a[a.length - 1] as Record<string, string>; return p.out.replace(HOLE, (_x, n: string) => g[n] ?? ''); });
      glued = glued.replace(phraseRe, x => dict[x] ?? x);
      if (glued !== s && !/[А-Яа-яЁё]/.test(glued)) return glued;
      if (s.includes(' · ')) {
        const parts = s.split(' · '), out = parts.map(x => core(x, depth + 1));
        if (out.some((x, i) => x !== parts[i])) return out.join(' · ');
      }
      if (s.includes(', ')) {                                   // "Широчайшие, Бицепс": a list — only when EVERY part is known
        const parts = s.split(', '), out = parts.map(x => core(x, depth + 1));
        if (out.every((x, i) => x !== parts[i])) return out.join(', ');
      }
      const m = LEAD_NUM.exec(s);
      if (m) { const rest = core(m[2], depth + 1); if (rest !== m[2]) return `${m[1]} ${rest}`; }
    }
    return s;
  };

  return (s: string): string => {
    if (!s || !/[А-Яа-яЁё]/.test(s)) return s;                    // nothing to translate (numbers, icons, Latin text)
    const lead = /^\s*/.exec(s)![0], trail = /\s*$/.exec(s)![0], key = normalize(s);
    let out = cache.get(key);
    if (out === undefined) { out = core(key, 0); cache.set(key, out); }
    return lead + out + trail;
  };
}
