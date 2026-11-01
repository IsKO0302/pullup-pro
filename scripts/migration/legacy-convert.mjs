// One-time migration tool: converts PULLUP PRO v1 (concatenated global scripts) into ES modules.
// Usage: node scripts/migration/legacy-convert.mjs <legacy src/js dir> <out root>
// Every top-level declaration is exported; imports are generated from cross-module references.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const [, , LEG = '/data/pullup/src/js', OUT = '/data/PULLUP-PRO'] = process.argv;
const W = 'apps/web/src/', SH = 'packages/shared/src/';
// statement-index based split rules: file -> [[fromIdx, toIdx, target]] ; default target per file
const PLAN = {
  '01-core.js': [
    [0, 0, null], [1, 1, SH + 'util'], [2, 3, W + 'core/dom'], [4, 11, SH + 'util'], [12, 12, SH + 'util'],
    [13, 33, SH + 'dates'], [34, 35, W + 'core/icons'], [36, 46, W + 'core/state'], [47, 48, W + 'core/audio'],
    [49, 49, W + 'components/toast'], [50, 53, W + 'components/modal'], [54, 57, W + 'core/events'],
    [58, 66, W + 'components/ui'], [67, 68, W + 'core/dom'], [69, 69, SH + 'util']
  ],
  '02-data-exercises.js': [[0, 999, SH + 'catalog/exercises']],
  '03-data-programs.js': [[0, 999, SH + 'catalog/programs']],
  '04-figure.js': [[0, 999, W + 'components/figure']],
  '05-charts.js': [[0, 999, W + 'components/charts']],
  '06-logic.js': [[0, 999, W + 'services/logic']],
  '07-app.js': [[0, 6, W + 'core/router'], [7, 7, W + 'layouts/shell'], [8, 19, W + 'components/view'], [20, 29, W + 'features/workout/start']],
  '10-home.js': [[0, 999, W + 'features/dashboard/home']],
  '11-programs.js': [[0, 999, W + 'features/programs/programs']],
  '12-muscleup.js': [[0, 999, W + 'features/muscle-up/muscle-up']],
  '13-library.js': [[0, 999, W + 'features/exercises/library']],
  '14-journal.js': [[0, 999, W + 'features/journal/journal']],
  '15-stats.js': [[0, 999, W + 'features/statistics/stats']],
  '16-calendar.js': [[0, 999, W + 'features/calendar/calendar']],
  '17-builder.js': [[0, 999, W + 'features/builder/builder']],
  '18-settings.js': [[0, 999, W + 'features/settings/settings']],
  '19-train.js': [[0, 999, W + 'features/workout/train']],
  '99-main.js': [[0, 2, W + 'features/workout/resume'], [3, 3, W + 'features/onboarding/onboarding'], [4, 4, W + 'main']]
};
const files = Object.keys(PLAN);
const mods = new Map(); // target -> { chunks: [text], decls: Set, refs: Set, assigns: Set }
const declOf = new Map(); // name -> target
const getMod = t => { if (!mods.has(t)) mods.set(t, { chunks: [], decls: new Set(), refs: new Set(), assigns: new Set(), lets: new Set() }); return mods.get(t); };

function declNames(st, sf) {
  if (ts.isFunctionDeclaration(st) && st.name) return [[st.name.text, 'function']];
  if (ts.isClassDeclaration(st) && st.name) return [[st.name.text, 'class']];
  if (ts.isVariableStatement(st)) {
    const k = st.declarationList.flags & ts.NodeFlags.Let ? 'let' : st.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'var';
    return st.declarationList.declarations.filter(d => ts.isIdentifier(d.name)).map(d => [d.name.text, k]);
  }
  return [];
}
function isRef(id) {
  const p = id.parent;
  if (!p) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === id) return false;
  if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isParameter(p) || ts.isClassDeclaration(p)) && p.name === id) return false;
  if (ts.isBindingElement(p) && (p.name === id || p.propertyName === id)) return false;
  if ((ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) && p.label === id) return false;
  return true;
}
function collect(node, refs, assigns) {
  const visit = n => {
    if (ts.isIdentifier(n) && isRef(n)) refs.add(n.text);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ts.isIdentifier(n.left)) assigns.add(n.left.text);
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken) && ts.isIdentifier(n.operand)) assigns.add(n.operand.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
}
for (const f of files) {
  const src = fs.readFileSync(path.join(LEG, f), 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const rules = PLAN[f];
  sf.statements.forEach((st, i) => {
    const r = rules.find(([a, b]) => i >= a && i <= b);
    if (!r) throw new Error(`no rule for ${f}#${i}`);
    const target = r[2]; if (!target) return;
    const m = getMod(target);
    const names = declNames(st, sf);
    let text = src.slice(st.getFullStart(), st.getEnd());
    // keep leading comments, add export keyword to declarations
    if (names.length) {
      const startTok = st.getStart(sf) - st.getFullStart();
      text = text.slice(0, startTok) + 'export ' + text.slice(startTok);
      for (const [n, k] of names) { if (declOf.has(n)) throw new Error('dup ' + n); declOf.set(n, target); m.decls.add(n); if (k === 'let' || k === 'var') m.lets.add(n); }
    }
    m.chunks.push(text);
    collect(st, m.refs, m.assigns);
  });
}
const rel = (from, to) => { let r = path.relative(path.dirname(from), to); if (!r.startsWith('.')) r = './' + r; return r; };
const report = [];
for (const [t, m] of mods) {
  const byMod = new Map();
  for (const r of m.refs) { const d = declOf.get(r); if (!d || d === t) continue; if (!byMod.has(d)) byMod.set(d, new Set()); byMod.get(d).add(r); }
  for (const a of m.assigns) { const d = declOf.get(a); if (d && d !== t) report.push(`${t}: assigns imported '${a}' (declared in ${d})`); }
  const imports = [...byMod.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, names]) => {
    const spec = d.startsWith(SH) && !t.startsWith(SH) ? '@pullup/shared/' + d.slice(SH.length) : rel(t, d);
    return `import { ${[...names].sort().join(', ')} } from '${spec}';`;
  });
  const out = path.join(OUT, t + '.ts');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const body = m.chunks.join('').replace(/^\s*\n/, '');
  fs.writeFileSync(out, (imports.length ? imports.join('\n') + '\n\n' : '') + body.trimStart() + '\n');
  report.push(`${t}.ts  decls=${m.decls.size} imports=${[...byMod.values()].reduce((a, s) => a + s.size, 0)} from ${byMod.size} modules`);
}
console.log(report.join('\n'));
