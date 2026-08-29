// Pure deal logic — no filesystem, no Node. Shared by the CLI, the local desk and the hosted desk.

export const ROLES = [
  "economic_buyer", "champion", "coach", "technical_buyer",
  "user_buyer", "blocker", "influencer"
];
export const BEATS = ["setup", "stakes", "conflict", "turn", "proof", "close", "result", "lesson"];
export const ZONES = ["stakeholders", "obstacles", "timeline", "meddpicc"];
export const OBSTACLE_TYPES = ["technical", "political", "legal", "commercial", "competitive", "timing"];

export const MEDDPICC = [
  ["metrics", "M", "Metrics"],
  ["economicBuyer", "E", "Economic Buyer"],
  ["decisionCriteria", "D", "Decision Criteria"],
  ["decisionProcess", "D", "Decision Process"],
  ["paperProcess", "P", "Paper Process"],
  ["identifyPain", "I", "Identify Pain"],
  ["champion", "C", "Champion"],
  ["competition", "C", "Competition"]
];

export const GATE_ICON = {
  technical: "▲", political: "⚑", legal: "§",
  commercial: "$", competitive: "⚔", timing: "⏱"
};

// Derive graph edges + defaults the renderer relies on.
export function normalize(deal) {
  const d = structuredClone(deal);
  d.meta ||= {};
  d.stakeholders ||= [];
  d.obstacles ||= [];
  d.timeline ||= [];
  d.steps ||= [];
  d.metrics ||= [];
  d.meddpicc ||= {};

  const edges = [];
  for (const s of d.stakeholders) {
    if (s.reportsTo) edges.push({ from: s.reportsTo, to: s.id, kind: "reports" });
  }
  for (const o of d.obstacles) {
    if (o.owner) edges.push({ from: o.owner, to: o.id, kind: "owns" });
  }
  d._edges = edges;

  d._orgs = [];
  for (const s of d.stakeholders) {
    const org = s.org || "Other";
    let lane = d._orgs.find((l) => l.name === org);
    if (!lane) { lane = { name: org, people: [] }; d._orgs.push(lane); }
    lane.people.push(s);
  }
  // Managers before reports inside a lane, then by influence.
  for (const lane of d._orgs) {
    lane.people.sort((a, b) => (a.reportsTo ? 1 : 0) - (b.reportsTo ? 1 : 0) || (b.influence || 0) - (a.influence || 0));
  }
  return d;
}

// Errors block a build; warnings do not.
export function validateDeal(d) {
  const issues = [];
  const err = (msg, where) => issues.push({ level: "error", msg, where });
  const warn = (msg, where) => issues.push({ level: "warn", msg, where });

  if (!d.meta?.dealName) err("meta.dealName is required", "meta");
  if (!d.steps.length) err("at least one step is required", "steps");

  const sids = new Set(), oids = new Set(), tids = new Set();
  for (const s of d.stakeholders) {
    if (!s.id) err("stakeholder without id", "stakeholders");
    else if (sids.has(s.id)) err(`duplicate stakeholder id "${s.id}"`, "stakeholders");
    sids.add(s.id);
    if (s.role && !ROLES.includes(s.role)) err(`unknown role "${s.role}" on ${s.id}`, `stakeholders.${s.id}`);
  }
  for (const s of d.stakeholders) {
    if (s.reportsTo && !sids.has(s.reportsTo)) err(`${s.id}.reportsTo -> unknown "${s.reportsTo}"`, "stakeholders");
  }
  for (const o of d.obstacles) {
    if (!o.id) err("obstacle without id", "obstacles");
    else if (oids.has(o.id)) err(`duplicate obstacle id "${o.id}"`, "obstacles");
    oids.add(o.id);
    if (o.type && !OBSTACLE_TYPES.includes(o.type)) warn(`unknown obstacle type "${o.type}" on ${o.id}`, "obstacles");
    if (o.owner && !sids.has(o.owner)) err(`${o.id}.owner -> unknown "${o.owner}"`, "obstacles");
  }
  for (const t of d.timeline) {
    if (!t.id) err("timeline entry without id", "timeline");
    else if (tids.has(t.id)) err(`duplicate timeline id "${t.id}"`, "timeline");
    tids.add(t.id);
  }
  for (const [key] of MEDDPICC) {
    if (!d.meddpicc[key]) warn(`meddpicc.${key} is missing`, "meddpicc");
  }
  d.steps.forEach((s, n) => {
    const at = `steps[${n}]`;
    if (!s.id) err("step without id", at);
    if (!s.title) err("step without title", at);
    if (s.beat && !BEATS.includes(s.beat)) warn(`unknown beat "${s.beat}"`, at);
    const sp = s.spotlight || {};
    (sp.stakeholders || []).forEach((id) => { if (!sids.has(id)) err(`spotlight -> unknown stakeholder "${id}"`, at); });
    (sp.obstacles || []).forEach((id) => { if (!oids.has(id)) err(`spotlight -> unknown obstacle "${id}"`, at); });
    (sp.timeline || []).forEach((id) => { if (!tids.has(id)) err(`spotlight -> unknown timeline "${id}"`, at); });
    (sp.meddpicc || []).forEach((k) => {
      if (!MEDDPICC.some(([key]) => key === k)) err(`spotlight -> unknown meddpicc key "${k}"`, at);
    });
    if (sp.focus && !ZONES.includes(sp.focus)) {
      err(`spotlight.focus "${sp.focus}" must be one of ${ZONES.join(", ")}`, at);
    }
  });
  return issues;
}
