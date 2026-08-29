// Anything on the map that no step touches is decoration the audience has to ignore.
export const id = "coverage";
export const about = "Every element on the map is used by the narrative.";

export function run(d) {
  const f = [];
  const used = { stakeholders: new Set(), obstacles: new Set(), meddpicc: new Set(), timeline: new Set() };
  for (const s of d.steps) {
    const sp = s.spotlight || {};
    for (const k of Object.keys(used)) (sp[k] || []).forEach((id) => used[k].add(id));
  }
  for (const s of d.stakeholders || []) {
    if (!used.stakeholders.has(s.id))
      f.push({ level: "warn", at: `stakeholder ${s.id}`, msg: `${s.name} never gets spotlighted — cut them or use them` });
  }
  for (const o of d.obstacles || []) {
    if (!used.obstacles.has(o.id))
      f.push({ level: "warn", at: `obstacle ${o.id}`, msg: `"${o.title}" is never told — cut it or spotlight it` });
  }
  const eb = (d.stakeholders || []).filter((s) => s.role === "economic_buyer");
  if (eb.length === 0) f.push({ level: "error", at: "stakeholders", msg: "no economic buyer on the map" });
  if (eb.length > 1) f.push({ level: "warn", at: "stakeholders", msg: `${eb.length} economic buyers — pick the one who owns the money` });
  if (!(d.stakeholders || []).some((s) => s.role === "champion"))
    f.push({ level: "error", at: "stakeholders", msg: "no champion on the map" });
  if (!(d.obstacles || []).some((o) => o.type === "technical"))
    f.push({ level: "warn", at: "obstacles", msg: "no technical hurdle — enterprise buyers expect one" });
  if ((d.stakeholders || []).length > 12)
    f.push({ level: "warn", at: "stakeholders", msg: "more than 12 stakeholders is a crowd, not a map" });
  for (const s of d.steps) {
    const sp = s.spotlight || {};
    const all = ["stakeholders", "obstacles", "meddpicc", "timeline"]
      .reduce((a, k) => a + (Array.isArray(sp[k]) ? sp[k].length : 0), 0);
    // Timeline ticks read as one highlighted path, so they cost less attention than cards.
    const cards = ["stakeholders", "obstacles", "meddpicc"]
      .reduce((a, k) => a + (Array.isArray(sp[k]) ? sp[k].length : 0), 0);
    if (all === 0 && !sp.metrics) f.push({ level: "warn", at: `step ${s.id}`, msg: "spotlights nothing — the map goes static while you talk" });
    if (cards > 5) f.push({ level: "warn", at: `step ${s.id}`, msg: `spotlights ${cards} cards — the eye can hold about five` });
    // The map scrolls, so a step spanning several zones cannot show them all at once.
    const zones = ["stakeholders", "obstacles", "timeline", "meddpicc"].filter((z) => (sp[z] || []).length);
    if (zones.length > 2 && !sp.focus) {
      f.push({ level: "warn", at: `step ${s.id}`,
        msg: `lights ${zones.length} zones (${zones.join(", ")}) — set spotlight.focus to say which one the map should land on` });
    }
  }
  return f;
}
