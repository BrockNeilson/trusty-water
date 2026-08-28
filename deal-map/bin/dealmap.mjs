#!/usr/bin/env node
// dealmap — build, check and scaffold deal-review visuals.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeal, loadBrand, validateDeal } from "../src/schema.mjs";
import { render } from "../src/render.mjs";
import { evaluate, report } from "../evals/run.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  deals: path.join(root, "data", "deals"),
  brands: path.join(root, "data", "brands"),
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
  const brandId = over.brandId || flag("brand", "default");
  const deal = loadDeal(dealPath(slug));
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
  const html = render({ deal, brand, presenter });
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

function newDeal() {
  const slug = String(flag("deal", "") || argv[1] || "");
  if (!slug || slug === "true") fail("usage: dealmap new --deal <slug>");
  const dst = path.join(P.deals, `${slug}.json`);
  if (fs.existsSync(dst)) fail(`${dst} already exists`);
  const tpl = JSON.parse(fs.readFileSync(path.join(P.deals, "northwind.json"), "utf8"));
  tpl.meta.slug = slug;
  tpl.meta.draft = true;
  fs.writeFileSync(dst, JSON.stringify(tpl, null, 2) + "\n");
  console.log(`${bold("created")} data/deals/${slug}.json ${dim("— replace the content, then run: npm run check -- --deal " + slug)}`);
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

function list() {
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
  ${bold("build-all")} --deal <slug>                           render the deck for every brand
  ${bold("check")}   --deal <slug> [--brand <id>] [--json]     run the evaluation suite
  ${bold("new")}     --deal <slug>                             scaffold a new deal from the example
  ${bold("brand")}   <id> [--company X] [--accent #HEX]        scaffold a white-label target
  ${bold("list")}                                              show deals and brands

${dim("Keys in the deck: ← → step · N presenter notes · O overview · F fullscreen · 1-9 jump")}`;

const run = { build, "build-all": buildAll, check, new: newDeal, brand: newBrand, list };
try {
  if (!cmd || cmd === "help" || cmd === "--help") console.log(help);
  else if (run[cmd]) await run[cmd]();
  else fail(`Unknown command "${cmd}"\n\n${help}`);
} catch (e) {
  if (e && e.code === "ERR_MODULE_NOT_FOUND") throw e;
  fail(e && e.message ? e.message : String(e));
}
