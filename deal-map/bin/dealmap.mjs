#!/usr/bin/env node
// dealmap — build, check and scaffold deal-review visuals.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeal, loadBrand, validateDeal } from "../src/schema.mjs";
import { render } from "../src/render.mjs";
import { evaluate, report } from "../evals/run.mjs";
import { serve } from "../src/server.mjs";
import { normalize as normAccount, validateAccount } from "../src/core/account.mjs";
import { buildTheme, contrast } from "../src/core/theme.mjs";
import { renderAccount } from "../src/core/render-account.mjs";
import { deckAssets } from "../src/render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  deals: path.join(root, "data", "deals"),
  brands: path.join(root, "data", "brands"),
  logos: path.join(root, "data", "brands", "logos"),
  accounts: path.join(root, "data", "accounts"),
  notes: path.join(root, "data", "notes"),
  presenter: path.join(root, "data", "presenter.json"),
  dist: path.join(root, "dist")
};

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
};

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function dealPath(slug) {
  const p = path.join(P.deals, `${slug}.json`);
  if (!fs.existsSync(p)) {
    const avail = fs.readdirSync(P.deals).map((f) => f.replace(/\.json$/, ""));
    fail(`Unknown deal "${slug}". Available: ${avail.join(", ")}`);
  }
  return p;
}
function fail(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); process.exit(1); }

function context(over = {}) {
  const slug = over.slug || flag("deal", "northwind");
  const deal = loadDeal(dealPath(slug));
  // --brand wins; otherwise use the audience the desk set on the deal.
  const brandId = over.brandId || flag("brand") || deal.meta.brand || "default";
  const brand = loadBrand(P.brands, brandId);
  const presenter = JSON.parse(fs.readFileSync(P.presenter, "utf8"));
  return { slug, brandId, deal, brand, presenter };
}

async function build(over = {}) {
  const { slug, brandId, deal, brand, presenter } = context(over);
  const errs = validateDeal(deal).filter((i) => i.level === "error");
  if (errs.length && !flag("force")) {
    console.error(bold("Cannot build — the deal data has structural errors:"));
    errs.forEach((e) => console.error(`  ✕ ${dim(e.where || "")} ${e.msg}`));
    console.error(dim("\nFix them, or pass --force to build anyway."));
    process.exit(1);
  }
  const html = render({ deal, brand, presenter, artifact: !!(over.artifact || flag("artifact")) });
  fs.mkdirSync(P.dist, { recursive: true });
  const outFlag = over.out || flag("out");
  const out = !outFlag || outFlag === true
    ? path.join(P.dist, `${slug}${brandId === "default" ? "" : "-" + brandId}.html`)
    : path.resolve(String(outFlag));
  fs.writeFileSync(out, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`${bold("built")} ${path.relative(process.cwd(), out)} ${dim(`(${kb} KB · ${deal.steps.length} steps · brand "${brandId}")`)}`);
  if (deal.meta?.draft) console.log(`\x1b[33m!\x1b[0m ${dim("meta.draft is true — the deck shows a SAMPLE DATA badge")}`);
  if (brand._logoMissing) console.log(`\x1b[33m!\x1b[0m ${dim(`logo not found at ${brand._logoMissing} — using the wordmark`)}`);
  return out;
}

async function check() {
  const { deal, brand, presenter } = context();
  const out = await evaluate(deal, { brand, presenter });
  console.log(report(out, { json: !!flag("json"), quiet: !!flag("quiet") }));
  if (!out.pass && !flag("no-fail")) process.exit(1);
}

async function buildAll() {
  const brands = fs.readdirSync(P.brands).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const slug = flag("deal", "northwind");
  for (const brandId of brands) await build({ slug, brandId });
}

// Where a story starts: a prose file you dump everything into.
function intake() {
  const slug = String(flag("deal", "") || argv[1] || "");
  if (!slug || slug === "true") fail('usage: dealmap intake <slug> [--company "Name"]');
  fs.mkdirSync(P.notes, { recursive: true });
  const dst = path.join(P.notes, `${slug}.md`);
  if (fs.existsSync(dst)) fail(`data/notes/${slug}.md already exists — open it and keep writing`);
  const company = typeof flag("company") === "string" ? String(flag("company")) : slug;
  const tpl = fs.readFileSync(path.join(P.notes, "_template.md"), "utf8").replace("<Customer>", company);
  fs.writeFileSync(dst, tpl);
  console.log(`${bold("created")} data/notes/${slug}.md`);
  console.log(dim(`  1. write in it — prose, fragments, a pasted transcript, however it comes out`));
  console.log(dim(`  2. hand it to the deal-story-coach agent, or ask Claude: "turn my ${slug} notes into a deal"`));
  console.log(dim(`  3. node bin/dealmap.mjs check --deal ${slug}`));
  return dst;
}

function newDeal() {
  const slug = String(flag("deal", "") || argv[1] || "");
  if (!slug || slug === "true") fail("usage: dealmap new --deal <slug>");
  const dst = path.join(P.deals, `${slug}.json`);
  if (fs.existsSync(dst)) fail(`${dst} already exists`);
  const tpl = JSON.parse(fs.readFileSync(path.join(P.deals, "northwind.json"), "utf8"));
  tpl.meta.slug = slug;
  tpl.meta.draft = true;
  fs.writeFileSync(dst, JSON.stringify(tpl, null, 2) + "\n");
  console.log(`${bold("created")} data/deals/${slug}.json ${dim("— the sample content, as a starting shape")}`);
  const notes = path.join(P.notes, `${slug}.md`);
  if (!fs.existsSync(notes)) {
    fs.mkdirSync(P.notes, { recursive: true });
    fs.writeFileSync(notes, fs.readFileSync(path.join(P.notes, "_template.md"), "utf8").replace("<Customer>", slug));
    console.log(`${bold("created")} data/notes/${slug}.md ${dim("— write the story here first; the deal file is generated from it")}`);
  }
}

function newBrand() {
  const id = String(flag("brand", "") || argv[1] || "");
  if (!id || id === "true") fail("usage: dealmap brand <id> [--company \"Name\"] [--accent '#RRGGBB'] [--logo path]");
  const dst = path.join(P.brands, `${id}.json`);
  const company = flag("company");
  const brand = {
    id,
    company: typeof company === "string" ? company : id.charAt(0).toUpperCase() + id.slice(1),
    wordmark: typeof company === "string" ? company : id.charAt(0).toUpperCase() + id.slice(1),
    logo: typeof flag("logo") === "string" ? String(flag("logo")) : null,
    preparedForLabel: "Prepared for",
    accent: typeof flag("accent") === "string" ? String(flag("accent")) : "#5B8DEF",
    accent2: typeof flag("accent2") === "string" ? String(flag("accent2")) : "#9B7BF0",
    bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5", font: "Inter"
  };
  fs.writeFileSync(dst, JSON.stringify(brand, null, 2) + "\n");
  console.log(`${bold("created")} data/brands/${id}.json ${dim(`— build with: npm run build -- --brand ${id}`)}`);
}

// ---- accounts: the value realisation plan that sits over the deals ----

function accountPath(slug) {
  const p = path.join(P.accounts, `${slug}.json`);
  if (!fs.existsSync(p)) {
    const avail = fs.existsSync(P.accounts)
      ? fs.readdirSync(P.accounts).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
      : [];
    fail(`Unknown account "${slug}".${avail.length ? " Available: " + avail.join(", ") : ""}`);
  }
  return p;
}

function loadAccount(slug) {
  return normAccount(JSON.parse(fs.readFileSync(accountPath(slug), "utf8")));
}

async function accountRules() {
  const dir = path.join(root, "evals", "account-rules");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort();
  return Promise.all(files.map((f) => import(path.join(dir, f))));
}

async function accountCmd() {
  const sub = argv[1];
  const slug = flag("account", typeof argv[2] === "string" && !argv[2].startsWith("--") ? argv[2] : "northwind");

  if (sub === "list") {
    if (!fs.existsSync(P.accounts)) return console.log(dim("no accounts yet"));
    for (const f of fs.readdirSync(P.accounts).filter((x) => x.endsWith(".json"))) {
      const a = JSON.parse(fs.readFileSync(path.join(P.accounts, f), "utf8"));
      const open = (a.pipeline || []).filter((p) => p.kind === "deal" && !String(p.stage || "").startsWith("closed"));
      console.log(`  ${f.replace(/\.json$/, "").padEnd(16)} ${dim(`${a.meta?.account || ""} · ${a.meta?.arr || "—"} ARR · ${(a.outcomes || []).length} outcomes · ${open.length} in flight${a.meta?.draft ? " · SAMPLE" : ""}`)}`);
    }
    return;
  }

  if (sub === "check") {
    const a = loadAccount(slug);
    const rules = await accountRules();
    const results = [{ id: "schema", about: "Structure the renderer requires.",
      findings: validateAccount(a).map((i) => ({ level: i.level, at: i.where, msg: i.msg })) }];
    for (const r of rules) {
      let findings = [];
      try { findings = r.run(a) || []; }
      catch (e) { findings = [{ level: "error", at: r.id, msg: `rule threw: ${e.message}` }]; }
      results.push({ id: r.id, about: r.about, findings });
    }
    const counts = { error: 0, warn: 0, info: 0 };
    results.forEach((r) => r.findings.forEach((f) => { counts[f.level] = (counts[f.level] || 0) + 1; }));
    const out = { results, counts, score: Math.max(0, 100 - counts.error * 8 - counts.warn * 2), pass: counts.error === 0 };
    console.log(report(out, { json: !!flag("json"), quiet: !!flag("quiet") }));
    if (!out.pass && !flag("no-fail")) process.exit(1);
    return;
  }

  if (sub === "build" || !sub) {
    const a = loadAccount(slug);
    const errs = validateAccount(a).filter((i) => i.level === "error");
    if (errs.length && !flag("force")) {
      console.error(bold("Cannot build — the account data has structural errors:"));
      errs.forEach((e) => console.error(`  ✕ ${dim(e.where || "")} ${e.msg}`));
      process.exit(1);
    }
    const brandId = flag("brand") || a.meta.brand || "default";
    const html = renderAccount({
      account: a, brand: loadBrand(P.brands, brandId),
      presenter: JSON.parse(fs.readFileSync(P.presenter, "utf8")),
      assets: deckAssets(), artifact: !!flag("artifact")
    });
    fs.mkdirSync(P.dist, { recursive: true });
    const out = typeof flag("out") === "string"
      ? path.resolve(String(flag("out")))
      : path.join(P.dist, `${slug}-value${brandId === "default" ? "" : "-" + brandId}.html`);
    fs.writeFileSync(out, html);
    console.log(`${bold("built")} ${path.relative(process.cwd(), out)} ${dim(`(${(Buffer.byteLength(html) / 1024).toFixed(0)} KB · ${a.steps.length} steps · brand "${brandId}")`)}`);
    if (a.meta.draft) console.log(`\x1b[33m!\x1b[0m ${dim("meta.draft is true — the plan shows a SAMPLE DATA badge")}`);
    return;
  }
  fail(`Unknown account command "${sub}". Try: build, check, list`);
}

// A tool-agnostic feed: anything that can export rows can drive the numbers.
function usageCmd() {
  const slug = flag("account", typeof argv[1] === "string" && !argv[1].startsWith("--") ? argv[1] : "");
  const file = typeof flag("file") === "string" ? String(flag("file")) : "";
  if (!slug || !file) fail("usage: dealmap usage <account> --file <feed.csv|feed.json> [--dry-run]");
  if (!fs.existsSync(file)) fail(`No such file: ${file}`);

  const raw = fs.readFileSync(file, "utf8");
  let rows;
  if (file.endsWith(".json")) {
    const j = JSON.parse(raw);
    rows = Array.isArray(j) ? j : j.rows;
    if (!Array.isArray(rows)) fail("JSON feed must be an array of rows, or an object with a rows array");
  } else {
    const lines = raw.trim().split(/\r?\n/);
    const head = lines.shift().split(",").map((h) => h.trim());
    const need = ["kind", "id", "field", "value"];
    for (const n of need) if (!head.includes(n)) fail(`CSV feed needs a "${n}" column. Header was: ${head.join(", ")}`);
    rows = lines.filter(Boolean).map((l) => {
      const cells = l.split(",");
      const o = {};
      head.forEach((h, i) => { o[h] = (cells[i] || "").trim(); });
      return o;
    });
  }

  const p = accountPath(slug);
  const account = JSON.parse(fs.readFileSync(p, "utf8"));
  const FIELDS = { product: ["licensed", "active"], outcome: ["current", "baseline", "target"] };
  const applied = [], skipped = [];

  for (const r of rows) {
    const coll = r.kind === "product" ? "products" : r.kind === "outcome" ? "outcomes" : null;
    if (!coll || !FIELDS[r.kind].includes(r.field)) { skipped.push(`${r.kind}/${r.id}/${r.field}`); continue; }
    const row = (account[coll] || []).find((x) => x.id === r.id);
    if (!row) { skipped.push(`${r.kind} "${r.id}" is not in this account`); continue; }
    const v = Number(r.value);
    if (!Number.isFinite(v)) { skipped.push(`${r.kind}/${r.id}/${r.field} is not a number`); continue; }
    if (row[r.field] !== v) applied.push(`${r.kind} ${r.id}.${r.field}: ${row[r.field]} → ${v}`);
    row[r.field] = v;
  }

  account.usage = account.usage || {};
  if (typeof flag("source") === "string") account.usage.source = String(flag("source"));
  account.usage.updated = new Date().toISOString().slice(0, 10);

  applied.forEach((a) => console.log(`  ${a}`));
  skipped.forEach((s2) => console.log(`  ${dim("skipped " + s2)}`));
  if (flag("dry-run")) return console.log(dim(`\ndry run — ${applied.length} change(s) not written`));
  fs.writeFileSync(p, JSON.stringify(account, null, 2) + "\n");
  console.log(`\n${bold(String(applied.length))} value(s) updated in data/accounts/${slug}.json. Review with git diff.`);
}

// What a brand actually resolves to, and whether every pair is readable.
function skinCmd() {
  const id = typeof argv[1] === "string" && !argv[1].startsWith("--") ? argv[1] : String(flag("brand", "default"));
  const brand = loadBrand(P.brands, id);
  const { vars, report, light } = buildTheme(brand);
  console.log(`${bold(brand.company || id)} ${dim(`(${light ? "light" : "dark"} ground)`)}`);
  console.log();
  const swatch = (hex) => {
    const m = /^#(..)(..)(..)$/.exec(hex);
    if (!m) return "  ";
    const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
    return `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;
  };
  for (const [k, v] of Object.entries(vars)) {
    if (!/^#/.test(String(v))) continue;
    console.log(`  ${swatch(v)} ${k.padEnd(14)} ${dim(v)}`);
  }
  console.log();
  const pairs = [
    ["body text on background", vars["--ink"], vars["--bg"], 7],
    ["muted text", vars["--ink-muted"], vars["--bg"], 4.5],
    ["accent as text", vars["--accent-ink"], vars["--bg"], 4.5],
    ["text on an accent fill", vars["--on-accent"], vars["--accent"], 4.5],
    ["on track", vars["--ok"], vars["--bg"], 4.5],
    ["at risk", vars["--warn"], vars["--bg"], 4.5],
    ["behind", vars["--risk"], vars["--bg"], 4.5]
  ];
  for (const [label, fg, bgc, min] of pairs) {
    const r = contrast(fg, bgc);
    const ok = r !== null && r >= min;
    console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✕\x1b[0m"} ${label.padEnd(24)} ${String(r).padStart(6)}:1 ${dim("want " + min + "+")}`);
  }
  if (report.length) {
    console.log();
    for (const r of report) console.log(`  ${r.level === "error" ? "\x1b[31m✕\x1b[0m" : "\x1b[33m!\x1b[0m"} ${r.msg}`);
  } else {
    console.log(`\n  ${dim("nothing needed repair")}`);
  }
}

async function serveCmd() {
  const port = Number(flag("port", 4173)) || 4173;
  const { url } = await serve({ port });
  console.log(`${bold("deal desk")} ${url}`);
  console.log(dim("  every edit writes a file in data/ — commit them like any other change"));
  console.log(dim("  ctrl-c to stop"));
}

// Bring an export from the hosted desk back into the repo.
function importExport() {
  const file = String(flag("file", "") || argv[1] || "");
  if (!file || file === "true") fail("usage: dealmap import <deal-desk-export.json>");
  if (!fs.existsSync(file)) fail(`No such file: ${file}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data.deals) fail("That file has no deals in it — is it a deal desk export?");
  const dry = !!flag("dry-run");
  let wrote = 0;
  for (const [slug, deal] of Object.entries(data.deals)) {
    const dst = path.join(P.deals, `${slug}.json`);
    const changed = !fs.existsSync(dst) || fs.readFileSync(dst, "utf8") !== JSON.stringify(deal, null, 2) + "\n";
    console.log(`  ${changed ? bold("deal   ") : dim("deal   ")} ${slug}${changed ? "" : dim(" (unchanged)")}`);
    if (changed && !dry) { fs.writeFileSync(dst, JSON.stringify(deal, null, 2) + "\n"); wrote++; }
  }
  for (const [slug, text] of Object.entries(data.notes || {})) {
    fs.mkdirSync(P.notes, { recursive: true });
    const dst = path.join(P.notes, `${slug}.md`);
    const changed = !fs.existsSync(dst) || fs.readFileSync(dst, "utf8") !== text;
    console.log(`  ${changed ? bold("notes  ") : dim("notes  ")} ${slug}${changed ? "" : dim(" (unchanged)")}`);
    if (changed && !dry) { fs.writeFileSync(dst, text); wrote++; }
  }
  for (const [id, brand] of Object.entries(data.brands || {})) {
    const b = { ...brand };
    if (b.logoData) {
      const m = /^data:image\/(png|jpeg|svg\+xml|webp);base64,(.+)$/.exec(b.logoData);
      if (m && !dry) {
        const ext = { png: ".png", jpeg: ".jpg", "svg+xml": ".svg", webp: ".webp" }[m[1]];
        fs.mkdirSync(P.logos, { recursive: true });
        fs.writeFileSync(path.join(P.logos, `${id}${ext}`), Buffer.from(m[2], "base64"));
        b.logo = `logos/${id}${ext}`;
      }
      delete b.logoData;
    }
    console.log(`  ${bold("audience")} ${id}`);
    if (!dry) { fs.writeFileSync(path.join(P.brands, `${id}.json`), JSON.stringify(b, null, 2) + "\n"); wrote++; }
  }
  if (data.presenter && !dry) fs.writeFileSync(P.presenter, JSON.stringify(data.presenter, null, 2) + "\n");
  console.log(dry ? dim("\ndry run — nothing written") : `\n${bold(String(wrote))} files written. Review with git diff before committing.`);
}

function list() {
  const notes = fs.existsSync(P.notes)
    ? fs.readdirSync(P.notes).filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    : [];
  if (notes.length) {
    console.log(bold("notes"));
    for (const f of notes) {
      const slug = f.replace(/\.md$/, "");
      const built = fs.existsSync(path.join(P.deals, `${slug}.json`));
      console.log(`  ${slug.padEnd(18)} ${dim(built ? "→ data/deals/" + slug + ".json" : "not turned into a deal yet")}`);
    }
  }
  const deals = fs.readdirSync(P.deals).filter((f) => f.endsWith(".json"));
  const brands = fs.readdirSync(P.brands).filter((f) => f.endsWith(".json"));
  console.log(bold("deals"));
  for (const f of deals) {
    const d = JSON.parse(fs.readFileSync(path.join(P.deals, f), "utf8"));
    console.log(`  ${f.replace(/\.json$/, "").padEnd(18)} ${dim(`${d.meta?.dealName || ""} · ${d.steps?.length || 0} steps${d.meta?.draft ? " · SAMPLE" : ""}`)}`);
  }
  console.log(bold("brands"));
  for (const f of brands) {
    const b = JSON.parse(fs.readFileSync(path.join(P.brands, f), "utf8"));
    console.log(`  ${b.id.padEnd(18)} ${dim(`${b.company || "(neutral)"} · ${b.accent}`)}`);
  }
}

const help = `${bold("dealmap")} — deal-review visuals for interviews

  ${bold("build")}   --deal <slug> --brand <id> [--out file]   render one self-contained HTML deck
          [--artifact]                              body-only form, for publishing as an Artifact
  ${bold("build-all")} --deal <slug>                           render the deck for every brand
  ${bold("check")}   --deal <slug> [--brand <id>] [--json]     run the evaluation suite
  ${bold("intake")}  <slug> [--company "Name"]                  start a raw notes file — this is where a story goes in
  ${bold("new")}     --deal <slug>                             scaffold a deal file plus its notes file
  ${bold("brand")}   <id> [--company X] [--accent #HEX]        scaffold a white-label target
  ${bold("skin")}    <brand-id>                                show the resolved tokens and every contrast pair
  ${bold("serve")}   [--port 4173]                             open the deal desk locally
  ${bold("hosted")}  [--out file]                              build the hosted desk (persists by republishing itself)
  ${bold("import")}  <export.json> [--dry-run]                 pull a hosted-desk export back into data/
  ${bold("account")} build|check|list [slug] [--brand id]      the value realisation plan over an account
  ${bold("usage")}   <account> --file <feed.csv>               push usage numbers in from a BI export
  ${bold("list")}                                              show deals and brands

${dim("Keys in the deck: ← → step · N presenter notes · O overview · F fullscreen · 1-9 jump")}`;

async function hosted() {
  const { buildHosted } = await import("./build-hosted.mjs");
  const { page } = buildHosted();
  const out = typeof flag("out") === "string" ? String(flag("out")) : path.join(P.dist, "deal-desk.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(`${bold("built")} ${path.relative(process.cwd(), out)} ${dim(`(${(Buffer.byteLength(page) / 1024).toFixed(0)} KB)`)}`);
}

const run = { build, "build-all": buildAll, check, intake, new: newDeal, brand: newBrand,
              list, serve: serveCmd, hosted, import: importExport, account: accountCmd, usage: usageCmd, skin: skinCmd };
try {
  if (!cmd || cmd === "help" || cmd === "--help") console.log(help);
  else if (run[cmd]) await run[cmd]();
  else fail(`Unknown command "${cmd}"\n\n${help}`);
} catch (e) {
  if (e && e.code === "ERR_MODULE_NOT_FOUND") throw e;
  fail(e && e.message ? e.message : String(e));
}
