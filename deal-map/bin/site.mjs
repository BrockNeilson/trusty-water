#!/usr/bin/env node
// Builds the public site: an index plus every deck explicitly marked publishable.
// Publishing is OPT-IN. This repository is public, and a value plan holds a
// customer's economics — nothing goes out unless meta.publish is literally true.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeal, loadBrand } from "../src/schema.mjs";
import { render, deckAssets } from "../src/render.mjs";
import { normalize as normAccount } from "../src/core/account.mjs";
import { renderAccount } from "../src/core/render-account.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  deals: path.join(root, "data", "deals"),
  accounts: path.join(root, "data", "accounts"),
  brands: path.join(root, "data", "brands"),
  presenter: path.join(root, "data", "presenter.json")
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : []);

export function buildSite(outDir, { includeDrafts = false } = {}) {
  const presenter = readJson(P.presenter);
  const entries = [], skipped = [];
  fs.mkdirSync(outDir, { recursive: true });

  for (const f of list(P.deals)) {
    const slug = f.replace(/\.json$/, "");
    const deal = loadDeal(path.join(P.deals, f));
    if (deal.meta.publish !== true && !includeDrafts) { skipped.push(`deal ${slug}`); continue; }
    const brand = loadBrand(P.brands, deal.meta.brand || "default");
    const file = `${slug}.html`;
    fs.writeFileSync(path.join(outDir, file),
      render({ deal, brand, presenter, assets: deckAssets() }));
    entries.push({ kind: "Deal map", slug, file, title: deal.meta.dealName,
      sub: deal.meta.oneLiner || deal.meta.industry || "", draft: !!deal.meta.draft,
      facts: [deal.meta.acv && `ACV ${deal.meta.acv}`, deal.meta.cycleDays && `${deal.meta.cycleDays}-day cycle`,
              deal.meta.outcome].filter(Boolean), accent: brand.accent });
  }

  for (const f of list(P.accounts)) {
    const slug = f.replace(/\.json$/, "");
    const a = normAccount(readJson(path.join(P.accounts, f)));
    // Accounts are never swept in by --include-drafts: an account is opt-in, always.
    if (a.meta.publish !== true) { skipped.push(`account ${slug} (opt-in only)`); continue; }
    const brand = loadBrand(P.brands, a.meta.brand || "default");
    const file = `${slug}-value.html`;
    fs.writeFileSync(path.join(outDir, file),
      renderAccount({ account: a, brand, presenter, assets: deckAssets() }));
    entries.push({ kind: "Value plan", slug, file, title: a.meta.account,
      sub: a.meta.oneLiner || a.meta.industry || "", draft: !!a.meta.draft,
      facts: [a.meta.arr && `ARR ${a.meta.arr}`, a.meta.renewal && `renews ${a.meta.renewal}`].filter(Boolean),
      accent: brand.accent });
  }

  fs.writeFileSync(path.join(outDir, "index.html"), indexPage(presenter, entries));
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
  return { entries, skipped };
}

function indexPage(presenter, entries) {
  const cards = entries.map((e) => `
      <a class="card" href="${esc(e.file)}">
        <div class="chips"><span class="chip" style="--c:${esc(e.accent)}">${esc(e.kind)}</span>
          ${e.draft ? '<span class="chip draft">Sample data</span>' : ""}</div>
        <h2>${esc(e.title)}</h2>
        <p>${esc(e.sub)}</p>
        <div class="facts">${e.facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
      </a>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(presenter.name)} — Deal Reviews</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0E1116;--panel:#161A21;--ink:#E7EBEF;--muted:#9AA6B2;--faint:#6B7885;--edge:#252E38;
  --display:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55;
  -webkit-font-smoothing:antialiased;padding:clamp(24px,5vw,64px) clamp(16px,4vw,48px)}
.wrap{max-width:1100px;margin:0 auto}
header{margin-bottom:34px}
h1{font-family:var(--display);font-size:clamp(26px,3.4vw,38px);font-weight:600;letter-spacing:-.02em;
  font-optical-sizing:auto}
header p{color:var(--muted);margin-top:8px;max-width:60ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
.card{display:flex;flex-direction:column;gap:9px;padding:20px;border:1px solid var(--edge);border-radius:16px;
  background:var(--panel);text-decoration:none;color:inherit;transition:.18s}
.card:hover{transform:translateY(-2px);border-color:var(--muted)}
.card h2{font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:-.01em;font-optical-sizing:auto}
.card p{font-size:13px;color:var(--muted);min-height:2.6em}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:99px;
  border:1px solid color-mix(in srgb,var(--c,var(--muted)) 50%,transparent);color:var(--c,var(--muted))}
.chip.draft{--c:#E0A23C}
.facts{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--faint);
  border-top:1px solid var(--edge);padding-top:11px;margin-top:auto}
.empty{border:1px dashed var(--edge);border-radius:16px;padding:34px;color:var(--muted);max-width:60ch}
.empty code{font-family:ui-monospace,monospace;color:var(--ink);font-size:13px}
footer{margin-top:40px;color:var(--faint);font-size:12.5px}
a:focus-visible{outline:2px solid var(--muted);outline-offset:3px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(presenter.name)}</h1>
    <p>${esc(presenter.title || "")}${presenter.title ? " · " : ""}Deal reviews and value realisation plans.
       Each one is a single screen you step through — use <strong>←</strong> and <strong>→</strong>.</p>
  </header>
  ${entries.length ? `<div class="grid">${cards}\n  </div>` : `<div class="empty">
    <p>Nothing is published yet.</p>
    <p style="margin-top:10px">Publishing is opt-in: set <code>"publish": true</code> in a deal's
    <code>meta</code> and push. Value plans are never published unless you set it explicitly,
    because this repository is public.</p>
  </div>`}
  <footer>Built from the repository. Publishing is opt-in — nothing appears here unless its
    <code>meta.publish</code> is true.</footer>
</div>
</body>
</html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] && !process.argv[2].startsWith("--")
    ? path.resolve(process.argv[2]) : path.join(root, "dist", "site");
  const { entries, skipped } = buildSite(out, { includeDrafts: process.argv.includes("--include-drafts") });
  console.log(`site → ${path.relative(process.cwd(), out)}`);
  entries.forEach((e) => console.log(`  published  ${e.kind.toLowerCase()} ${e.slug}${e.draft ? " (sample data)" : ""}`));
  skipped.forEach((s) => console.log(`  skipped    ${s}`));
  if (!entries.length) console.log("  nothing published — set meta.publish to true on what you want live");
}
