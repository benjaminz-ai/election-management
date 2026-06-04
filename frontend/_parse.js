const ts=require("typescript");
const fs=require("fs");
for (const f of ["lib/auth.tsx","app/enroll-mfa/page.tsx"]) {
  const src=fs.readFileSync(f,"utf8");
  const sf=ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diags = sf.parseDiagnostics || [];
  console.log("==== "+f+"  (parseErrors="+diags.length+") ====");
  for (const d of diags.slice(0,6)) {
    const pos = sf.getLineAndCharacterOfPosition(d.start);
    console.log("  line "+(pos.line+1)+":"+(pos.character+1)+"  "+ts.flattenDiagnosticMessageText(d.messageText,"\n"));
    const lines=src.split("\n");
    for(let i=Math.max(0,pos.line-2);i<=pos.line;i++) console.log("    "+(i+1)+"| "+lines[i]);
  }
}
