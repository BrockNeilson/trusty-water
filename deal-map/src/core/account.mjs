// Pure account logic. An account owns the deals and the plan for realising value
// from what those deals sold. No filesystem, no Node — the browser uses this too.

export const OUTCOME_STATUS = ["on_track", "at_risk", "behind", "realised"];
export const PIPE_KINDS = ["deal", "whitespace"];
export const PIPE_STAGES = ["discovery", "validation", "negotiation", "closed_won", "closed_lost", "idea"];
export const ACCOUNT_ZONES = ["outcomes", "products", "pipeline", "plan", "economics"];

export const HEALTH = { green: "Healthy", amber: "Watch", red: "At risk" };

// A value hypothesis is only measurable if it has all three numbers.
export function progress(o) {
  const b = Number(o.baseline), c = Number(o.current), t = Number(o.target);
  if (![b, c, t].every(Number.isFinite) || b === t) return null;
  const pct = ((c - b) / (t - b)) * 100;
  return Math.max(0, Math.min(120, Math.round(pct)));
}

export function adoption(p) {
  const l = Number(p.licensed), a = Number(p.active);
  if (!Number.isFinite(l) || !Number.isFinite(a) || l <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((a / l) * 100)));
}

export function normalize(account) {
  const a = structuredClone(account);
  a.meta ||= {};
  a.products ||= [];
  a.outcomes ||= [];
  a.pipeline ||= [];
  a.plan ||= [];
  a.economics ||= { tiles: [] };
  a.economics.tiles ||= [];
  a.steps ||= [];
  // Open pipeline first, then what is already won — that is the order it gets talked about.
  a._open = a.pipeline.filter((p) => p.kind === "deal" && !String(p.stage || "").startsWith("closed"));
  a._won = a.pipeline.filter((p) => p.stage === "closed_won");
  a._white = a.pipeline.filter((p) => p.kind === "whitespace");
  return a;
}

export function validateAccount(a) {
  const issues = [];
  const err = (msg, where) => issues.push({ level: "error", msg, where });
  const warn = (msg, where) => issues.push({ level: "warn", msg, where });

  if (!a.meta?.account) err("meta.account is required", "meta");
  if (!a.steps.length) err("at least one step is required", "steps");

  const ids = {};
  for (const key of ["outcomes", "products", "pipeline", "plan"]) {
    ids[key] = new Set();
    for (const row of a[key]) {
      if (!row.id) err(`${key} row without id`, key);
      else if (ids[key].has(row.id)) err(`duplicate ${key} id "${row.id}"`, key);
      ids[key].add(row.id);
    }
  }
  for (const o of a.outcomes) {
    if (o.status && !OUTCOME_STATUS.includes(o.status)) warn(`unknown status "${o.status}" on ${o.id}`, "outcomes");
    if (progress(o) === null) warn(`${o.id} has no measurable baseline, current and target`, "outcomes");
  }
  for (const p of a.pipeline) {
    if (p.kind && !PIPE_KINDS.includes(p.kind)) err(`${p.id}.kind must be deal or whitespace`, "pipeline");
    if (p.stage && !PIPE_STAGES.includes(p.stage)) warn(`unknown stage "${p.stage}" on ${p.id}`, "pipeline");
  }
  a.steps.forEach((s, n) => {
    const at = `steps[${n}]`;
    if (!s.id) err("step without id", at);
    if (!s.title) err("step without title", at);
    const sp = s.spotlight || {};
    for (const key of ["outcomes", "products", "pipeline", "plan"]) {
      (sp[key] || []).forEach((id) => {
        if (!ids[key].has(id)) err(`spotlight -> unknown ${key} "${id}"`, at);
      });
    }
    if (sp.focus && !ACCOUNT_ZONES.includes(sp.focus)) {
      err(`spotlight.focus "${sp.focus}" must be one of ${ACCOUNT_ZONES.join(", ")}`, at);
    }
  });
  return issues;
}
