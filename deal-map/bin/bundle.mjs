// A tiny, deliberately strict ESM flattener for our own modules.
// It handles exactly the syntax this project uses and throws on anything else,
// so it can never silently produce a broken bundle.
import fs from "node:fs";
import path from "node:path";

const IMPORT_RE = /^import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:from\s*)?["']([^"']+)["'];?\s*$/;
const EXPORT_STAR_RE = /^export\s+\*\s+from\s+["'][^"']+["'];?\s*$/;
const UNSUPPORTED = [
  [/\bexport\s+default\b/, "export default"],
  [/\bimport\s*\(/, "dynamic import()"],
  [/\bimport\.meta\b/, "import.meta"],
  [/\bexport\s*\{/, "export { } list"],
  [/\brequire\s*\(/, "require()"],
  [/\bnode:/, "a node: builtin"]
];

// Depth-first over the import graph, so a module is emitted after everything it uses.
export function bundle(entries, { root }) {
  const seen = new Set();
  const out = [];

  const visit = (file) => {
    const abs = path.resolve(file);
    if (seen.has(abs)) return;
    seen.add(abs);
    const src = fs.readFileSync(abs, "utf8");
    const rel = path.relative(root, abs);

    for (const [re, what] of UNSUPPORTED) {
      if (re.test(src)) throw new Error(`${rel} uses ${what}, which bundle.mjs does not support`);
    }

    const lines = src.split("\n");
    const kept = [];
    for (const line of lines) {
      const m = IMPORT_RE.exec(line.trim());
      if (m) { visit(path.resolve(path.dirname(abs), m[1])); continue; }
      if (EXPORT_STAR_RE.test(line.trim())) continue;
      kept.push(line.replace(/^export\s+(const|let|function|async function|class)\s/, "$1 "));
    }
    out.push(`/* ---- ${rel} ---- */\n${kept.join("\n").trim()}`);
  };

  entries.forEach(visit);
  return out.join("\n\n");
}

// Eval rules each export id/about/run, so they cannot share a scope — wrap each
// in its own closure and push it onto a list. Core modules stay top-level.
export function bundleRules(files, { root }) {
  const parts = files.map((file) => {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    for (const [re, what] of UNSUPPORTED) {
      if (re.test(src)) throw new Error(`${rel} uses ${what}, which bundle.mjs does not support`);
    }
    const body = src.split("\n")
      .filter((l) => !IMPORT_RE.test(l.trim()) && !EXPORT_STAR_RE.test(l.trim()))
      .map((l) => l.replace(/^export\s+(const|let|function|async function|class)\s/, "$1 "))
      .join("\n").trim();
    return `RULES.push((function () {\n/* ${rel} */\n${body}\nreturn { id: id, about: about, run: run };\n})());`;
  });
  return `var RULES = [];\n${parts.join("\n\n")}`;
}

export const jsString = (s) => JSON.stringify(s);
