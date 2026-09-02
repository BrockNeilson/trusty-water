// The same discipline the deck gets: short, spoken, landing on one zone at a time.
export const id = "walkthrough";
export const about = "The account walks in an arc and lands cleanly.";

const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const ZONES = ["outcomes", "products", "pipeline", "plan"];

export function run(a) {
  const f = [];
  if (a.meta && a.meta.draft) f.push({ level: "error", at: "meta.draft", msg: "still flagged as sample data" });
  if (a.steps.length < 4) f.push({ level: "warn", at: "steps", msg: `${a.steps.length} steps — an account review needs at least four` });
  if (a.steps.length > 10) f.push({ level: "error", at: "steps", msg: `${a.steps.length} steps — you will run out of the meeting` });

  a.steps.forEach((s, i) => {
    const at = `steps[${i}] ${s.id || ""}`.trim();
    if (words(s.title) > 6) f.push({ level: "error", at, msg: `title is ${words(s.title)} words (max 6): "${s.title}"` });
    if ((s.bullets || []).length > 3) f.push({ level: "error", at, msg: `${s.bullets.length} bullets (max 3)` });
    (s.bullets || []).forEach((b, n) => {
      if (words(b) > 10) f.push({ level: "error", at: `${at}.bullets[${n}]`, msg: `${words(b)} words (max 10): "${b}"` });
    });
    if (!s.notes) f.push({ level: "warn", at, msg: "no presenter note" });
    const sp = s.spotlight || {};
    const zones = ZONES.filter((z) => (sp[z] || []).length);
    if (!zones.length && !sp.metrics && !sp.focus)
      f.push({ level: "warn", at, msg: "spotlights nothing — the map goes static while you talk" });
    if (zones.length > 2 && !sp.focus)
      f.push({ level: "warn", at, msg: `lights ${zones.length} zones with no focus set` });
  });

  const beats = a.steps.map((s) => s.beat);
  if (!beats.includes("conflict") && !a.outcomes.some((o) => ["at_risk", "behind"].includes(o.status)))
    f.push({ level: "warn", at: "steps", msg: "no step covers what is not working — that is the part they trust" });
  return f;
}
