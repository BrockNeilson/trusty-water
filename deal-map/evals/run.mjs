// Deterministic eval harness. Rules are pure functions: (deal, ctx) -> findings[].
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeal } from "../src/core/deal.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function loadRules() {
  const dir = path.join(here, "rules");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort();
  return Promise.all(files.map((f) => import(path.join(dir, f))));
}

export async function evaluate(deal, ctx = {}, suppliedRules) {
  const rules = suppliedRules || await loadRules();
  const results = [];
  const structural = validateDeal(deal).map((i) => ({ level: i.level, at: i.where, msg: i.msg }));
  results.push({ id: "schema", about: "Structure the renderer requires.", findings: structural });
  for (const rule of rules) {
    let findings = [];
    try { findings = rule.run(deal, ctx) || []; }
    catch (e) { findings = [{ level: "error", at: rule.id, msg: `rule threw: ${e.message}` }]; }
    results.push({ id: rule.id, about: rule.about, findings });
  }
  const counts = { error: 0, warn: 0, info: 0 };
  for (const r of results) for (const f of r.findings) counts[f.level] = (counts[f.level] || 0) + 1;
  const score = scoreOf(counts);
  return { results, counts, score, pass: counts.error === 0 };
}

// 100 minus 8 per error, 2 per warning. Blunt on purpose: it should move when you fix things.
export function scoreOf(c) {
  return Math.max(0, 100 - c.error * 8 - c.warn * 2);
}

const COLOR = { error: "\x1b[31m", warn: "\x1b[33m", info: "\x1b[36m", reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m" };
const MARK = { error: "✕", warn: "!", info: "·" };

export function report(out, { json = false, quiet = false } = {}) {
  if (json) return JSON.stringify(out, null, 2);
  const L = [];
  for (const r of out.results) {
    const shown = quiet ? r.findings.filter((f) => f.level !== "info") : r.findings;
    if (!shown.length) { L.push(`${COLOR.dim}✓ ${r.id}${COLOR.reset}`); continue; }
    L.push(`${COLOR.bold}${r.id}${COLOR.reset} ${COLOR.dim}— ${r.about}${COLOR.reset}`);
    for (const f of shown) {
      L.push(`  ${COLOR[f.level]}${MARK[f.level]}${COLOR.reset} ${COLOR.dim}${f.at || ""}${COLOR.reset} ${f.msg}`);
    }
  }
  L.push("");
  L.push(`${COLOR.bold}score ${out.score}/100${COLOR.reset}  ` +
    `${COLOR.error}${out.counts.error} errors${COLOR.reset}  ` +
    `${COLOR.warn}${out.counts.warn} warnings${COLOR.reset}  ` +
    `${COLOR.dim}${out.counts.info} notes${COLOR.reset}`);
  return L.join("\n");
}
