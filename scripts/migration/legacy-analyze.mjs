// Prints top-level statements of a legacy file (kind + head) to plan module splitting.
import ts from 'typescript';
import fs from 'node:fs';
const [, , file] = process.argv;
const src = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
sf.statements.forEach((st, i) => {
  let names = [];
  if (ts.isFunctionDeclaration(st) && st.name) names = [st.name.text];
  else if (ts.isVariableStatement(st)) names = st.declarationList.declarations.map(d => d.name.getText(sf));
  console.log(i, ts.SyntaxKind[st.kind], names.join(',') || st.getText(sf).slice(0, 90).replace(/\s+/g, ' '));
});
