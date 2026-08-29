// MEDDPICC is the credibility layer. Gaps here are what an interviewer probes.
import { MEDDPICC } from "../../src/core/deal.mjs";
export const id = "meddpicc";
export const about = "Every letter is filled, scored, and evidenced.";

export function run(d) {
  const f = [];
  let scored = 0, total = 0;
  for (const [key, , name] of MEDDPICC) {
    const m = (d.meddpicc || {})[key];
    if (!m) { f.push({ level: "error", at: `meddpicc.${key}`, msg: `${name} is missing — expect to be asked about it` }); continue; }
    if (typeof m.score !== "number" || m.score < 0 || m.score > 3)
      f.push({ level: "error", at: `meddpicc.${key}`, msg: "score must be 0-3" });
    else { scored += m.score; total += 3; }
    if (!m.headline) f.push({ level: "error", at: `meddpicc.${key}`, msg: `${name} has no headline` });
    if (!m.proof) f.push({ level: "warn", at: `meddpicc.${key}`, msg: `${name} has no proof line — the headline is a claim without it` });
    if (m.score <= 1 && !m.proof)
      f.push({ level: "warn", at: `meddpicc.${key}`, msg: `${name} scores low with no explanation — name the gap before they find it` });
  }
  if (total) {
    const pct = Math.round((scored / total) * 100);
    f.push({ level: "info", at: "meddpicc", msg: `qualification strength ${scored}/${total} (${pct}%)` });
    if (pct < 60) f.push({ level: "warn", at: "meddpicc", msg: "under 60% — this reads as a deal you got lucky on" });
  }
  return f;
}
