// Transpile the real plugin sources to browser ESM for the mock harness.
const fs = require("fs"), path = require("path");
// TypeScript: a local install if there is one, else the copy bundled with VS Code.
function loadTs() {
  try { return require("typescript"); } catch {}
  const vscode = path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code");
  for (const dir of fs.existsSync(vscode) ? fs.readdirSync(vscode) : []) {
    const p = path.join(vscode, dir, "resources/app/extensions/node_modules/typescript/lib/typescript.js");
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("TypeScript not found: run `npm i -D typescript` here or install VS Code.");
}
const ts = loadTs();
const src = path.join(__dirname, "../../vencord/userplugins/discordPlus"), out = path.join(__dirname, "plugin");
fs.rmSync(out, { recursive: true, force: true });
for (const rel of fs.readdirSync(src, { recursive: true })) {
  const file = path.join(src, rel);
  if (fs.statSync(file).isDirectory()) continue;
  const target = path.join(out, rel).replace(/\.tsx?$/, ".js");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!/\.tsx?$/.test(rel)) { fs.copyFileSync(file, path.join(out, rel)); continue; }
  let code = fs.readFileSync(file, "utf8").replace(/import managedStyle from "\.\/style\.css\?managed";/, 'const managedStyle = "";');
  let js = ts.transpileModule(code, { fileName: rel, compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: "VencordCreateElement", jsxFragmentFactory: "VencordFragment", module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  js = js.replace(/from "(\.{1,2}\/[^"]+)"/g, (m, p) => `from "${p}.js"`);
  fs.writeFileSync(target, js);
}
console.log("built", out);
