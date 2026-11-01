// One-time migration tool: annotates dynamic legacy declarations with explicit `any`
// so the ported v1 UI modules type-check (tsc) without changing runtime behaviour.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const cfgPath = process.argv[2] || 'apps/web/tsconfig.json';
const MAXPASS = 12;
for (let pass = 1; pass <= MAXPASS; pass++) {
  const cfg = ts.getParsedCommandLineOfConfigFile(path.resolve(cfgPath), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => console.error(d) });
  const prog = ts.createProgram(cfg.fileNames, cfg.options);
  const checker = prog.getTypeChecker();
  const diags = ts.getPreEmitDiagnostics(prog).filter(d => d.file && !d.file.fileName.includes('node_modules') && d.file.fileName.includes('/apps/web/'));
  console.log(`pass ${pass}: ${diags.length} errors`);
  if (!diags.length) break;
  const edits = new Map(); // file -> Map(pos -> text)
  const addEdit = (sf, pos, text) => { if (!edits.has(sf.fileName)) edits.set(sf.fileName, new Map()); const m = edits.get(sf.fileName); if (m.has(pos) && m.get(pos) !== text && !m.get(pos).includes(text)) m.set(pos, m.get(pos) + text); else m.set(pos, text); };
  const nodeAt = (sf, pos) => { let found; const f = n => { if (pos >= n.getStart(sf) && pos < n.getEnd()) { found = n; ts.forEachChild(n, f); } }; f(sf); return found; };
  const annotateDecl = d => {
    if (!d) return false;
    const sf = d.getSourceFile();
    if (sf.fileName.includes('node_modules') || sf.fileName.includes('/packages/')) return false;
    if ((ts.isVariableDeclaration(d) || ts.isParameter(d)) && !d.type && ts.isIdentifier(d.name)) {
      const q = d.questionToken ? d.questionToken.getEnd() : d.name.getEnd();
      const fn = d.parent;
      if (ts.isParameter(d) && ts.isArrowFunction(fn) && fn.parameters.length === 1 && !sf.text.slice(fn.getStart(sf), d.getStart(sf)).includes('(')) {
        addEdit(sf, d.getStart(sf), '('); addEdit(sf, q, ': any)'); return true;
      }
      addEdit(sf, q, ': any'); return true;
    }
    return false;
  };
  let unresolved = 0;
  for (const dg of diags) {
    const sf = dg.file; const n = nodeAt(sf, dg.start);
    let ok = false;
    if (dg.code === 2339 || dg.code === 2551 || dg.code === 18046 || dg.code === 2571) {
      // property access on a too-narrow type: annotate the declaration that produced the object type
      let pa = n; while (pa && !ts.isPropertyAccessExpression(pa) && !ts.isElementAccessExpression(pa)) pa = pa.parent;
      let obj = pa ? pa.expression : n;
      if (dg.code === 18046) obj = n;
      const t = checker.getTypeAtLocation(obj);
      const sym = t.getSymbol() || t.aliasSymbol;
      const decl = sym && sym.declarations && sym.declarations[0];
      if (decl && ts.isObjectLiteralExpression(decl)) {
        let p = decl.parent; while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;
        if (p && ts.isVariableDeclaration(p)) ok = annotateDecl(p);
      }
      if (!ok) { // fall back to the root identifier of the access chain
        let r = obj; while (r && (ts.isPropertyAccessExpression(r) || ts.isElementAccessExpression(r) || ts.isCallExpression(r) || ts.isParenthesizedExpression(r) || ts.isNonNullExpression(r))) r = r.expression;
        if (r && ts.isIdentifier(r)) { const s2 = checker.getSymbolAtLocation(r); const d2 = s2 && s2.valueDeclaration; ok = annotateDecl(d2); }
      }
    } else if (dg.code === 2554) {
      let c = n; while (c && !ts.isCallExpression(c) && !ts.isNewExpression(c)) c = c.parent;
      if (c) {
        const sig = checker.getResolvedSignature(c); const decl = sig && sig.declaration;
        const got = c.arguments ? c.arguments.length : 0;
        if (decl && decl.parameters && !decl.getSourceFile().fileName.includes('node_modules')) {
          const dsf = decl.getSourceFile();
          if (got < decl.parameters.length) {
            decl.parameters.forEach((p, i) => { if (i >= got && !p.initializer && !p.questionToken && !p.dotDotDotToken) addEdit(dsf, p.name.getEnd(), '?'); });
            ok = true;
          } else if (got > decl.parameters.length && !decl.parameters.some(p => p.dotDotDotToken)) {
            const last = decl.parameters[decl.parameters.length - 1];
            const pos = last ? last.getEnd() : decl.parameters.pos;
            addEdit(dsf, pos, last ? ', ..._extra: any[]' : '..._extra: any[]'); ok = true;
          }
        }
      }
    } else if (dg.code === 2345 || dg.code === 2322 || dg.code === 2362 || dg.code === 2363 || dg.code === 2365 || dg.code === 2556) {
      // annotate the identifier involved (argument / assignment target) as any when it is a local declaration
      let r = n; while (r && !ts.isIdentifier(r) && r.parent) r = r.getChildren(sf).find(ch => ts.isIdentifier(ch)) || null;
      if (r && ts.isIdentifier(r)) { const s2 = checker.getSymbolAtLocation(r); ok = annotateDecl(s2 && s2.valueDeclaration); }
    }
    if (!ok) { unresolved++; if (pass >= MAXPASS - 1 || unresolved <= 0) {} }
  }
  if (!edits.size) {
    for (const dg of diags.slice(0, 40)) { const { line, character } = dg.file.getLineAndCharacterOfPosition(dg.start); console.log(`  ${path.relative(process.cwd(), dg.file.fileName)}:${line + 1}:${character + 1} TS${dg.code} ${ts.flattenDiagnosticMessageText(dg.messageText, ' ').slice(0, 140)}`); }
    break;
  }
  for (const [file, m] of edits) {
    let src = fs.readFileSync(file, 'utf8');
    for (const pos of [...m.keys()].sort((a, b) => b - a)) src = src.slice(0, pos) + m.get(pos) + src.slice(pos);
    fs.writeFileSync(file, src);
  }
  console.log(`  applied ${[...edits.values()].reduce((a, m) => a + m.size, 0)} edits in ${edits.size} files (unresolved ${unresolved})`);
}
