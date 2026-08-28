#!/usr/bin/env node
// Builds the hosted desk: one page that carries the whole tool, the current data,
// and a base64 copy of its own template so it can republish itself when you save.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle, bundleRules } from "./bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const listJson = (dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".json"));

function currentState() {
  const deals = {}, brands = {}, notes = {};
  for (const f of listJson("data/deals")) {
    const d = readJson(`data/deals/${f}`);
    deals[f.replace(/\.json$/, "")] = d;
  }
  for (const f of listJson("data/brands")) {
    const b = readJson(`data/brands/${f}`);
    if (b.logo) {
      const lp = path.join(root, "data/brands", b.logo);
      if (fs.existsSync(lp)) {
        const ext = path.extname(lp).toLowerCase();
        const mime = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
                       ".jpeg": "image/jpeg", ".webp": "image/webp" }[ext];
        if (mime) b.logoData = `data:${mime};base64,${fs.readFileSync(lp).toString("base64")}`;
      }
      delete b.logo;
    }
    brands[b.id] = b;
  }
  const notesDir = path.join(root, "data/notes");
  if (fs.existsSync(notesDir)) {
    for (const f of fs.readdirSync(notesDir)) {
      if (f.endsWith(".md") && !f.startsWith("_")) notes[f.replace(/\.md$/, "")] = read(`data/notes/${f}`);
    }
  }
  return { presenter: readJson("data/presenter.json"), deals, brands, notes, updatedAt: new Date().toISOString() };
}

const safe = (s) => s.replace(/<\/script/gi, "<\\/script");

export function buildHosted() {
  const core = bundle([path.join(root, "src/core/render.mjs")], { root });
  const ruleFiles = fs.readdirSync(path.join(root, "evals/rules"))
    .filter((f) => f.endsWith(".mjs")).sort().map((f) => path.join(root, "evals/rules", f));
  const rules = bundleRules(ruleFiles, { root });

  const engine = `${core}\n\n${rules}`;
  const deckAssets = JSON.stringify({ css: read("src/assets/styles.css"), js: read("src/assets/app.js") });
  const notesTemplate = JSON.stringify(read("data/notes/_template.md"));

  // %%SHELL%% and %%STATE%% are filled at publish time — by this build for version 1,
  // and by the page itself every time you save.
  const template = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deal desk</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<style>${read("src/assets/dashboard.css")}\n${read("src/assets/desk.css")}</style>
</head>
<body>
${read("src/assets/desk.html")}
<script type="text/plain" id="shell">%%SHELL%%</script>
<script type="application/json" id="state">%%STATE%%</script>
<script>
window.__SHELL_B64__ = document.getElementById("shell").textContent.trim();
window.__DESK_STATE__ = JSON.parse(document.getElementById("state").textContent);
window.__DECK_ASSETS__ = ${safe(deckAssets)};
window.__NOTES_TEMPLATE__ = ${safe(notesTemplate)};
</script>
<script>
${safe(engine)}
${safe(read("src/assets/desk.js"))}
</script>
</body>
</html>`;

  const shellB64 = Buffer.from(template, "utf8").toString("base64");
  const state = JSON.stringify(currentState()).replace(/</g, "\\u003c");
  const page = template.replace("%%SHELL%%", shellB64).replace("%%STATE%%", state);
  return { page, template, shellB64 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || path.join(root, "dist", "deal-desk.html");
  const { page, shellB64 } = buildHosted();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(`built ${path.relative(process.cwd(), out)}`);
  console.log(`  page ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB · self-template ${(shellB64.length / 1024).toFixed(0)} KB`);
}
