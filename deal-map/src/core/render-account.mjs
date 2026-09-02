// The value realisation map. Same shell, same step-through, different zones.
import { progress, adoption, HEALTH } from "./account.mjs";
import { renderShell, esc } from "./shell.mjs";

// Big raw numbers are unreadable on a meter; compact them and keep the unit separate.
const num = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v == null ? "" : v);
  if (Math.abs(n) >= 1000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return String(n);
};

const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", behind: "Behind", realised: "Realised" };
const STAGE_LABEL = { discovery: "Discovery", validation: "Validation", negotiation: "Negotiation",
                      closed_won: "Closed won", closed_lost: "Closed lost", idea: "Idea" };

function accountbar(a) {
  const m = a.meta;
  const pills = [
    m.arr && `<span class="pill">ARR ${esc(m.arr)}</span>`,
    m.renewal && `<span class="pill">Renews ${esc(m.renewal)}</span>`,
    m.since && `<span class="pill">Customer since ${esc(m.since)}</span>`,
    m.health && `<span class="pill health-${esc(m.health)}">${esc(HEALTH[m.health] || m.health)}</span>`
  ].filter(Boolean).join("");
  return `<div class="dealbar">
    <span class="name">${esc(m.account)}</span>
    <span class="meta">${esc(m.industry || "")}${m.segment ? " · " + esc(m.segment) : ""}</span>
    <span class="spacer"></span>${pills}
  </div>`;
}

/* A value hypothesis is a magnitude against a target, so it gets a meter, not a chart.
   Status is carried by a written label as well as colour. */
function outcomes(a) {
  if (!a.outcomes.length) return "";
  return `<div>
    <div class="zone-label">Value outcomes — what they bought this for</div>
    <div class="outcomes">${a.outcomes.map((o) => {
      const pct = progress(o);
      const st = o.status || (pct === null ? "" : pct >= 90 ? "realised" : pct >= 50 ? "on_track" : "at_risk");
      return `<div class="outcome" data-id="${esc(o.id)}" data-status="${esc(st)}">
        <div class="o-top">
          <span class="o-title">${esc(o.title)}</span>
          ${st ? `<span class="o-status">${esc(STATUS_LABEL[st] || st)}</span>` : ""}
        </div>
        <div class="o-metric">${esc(o.metric || "")}</div>
        ${pct === null ? "" : `<div class="meter" role="img" aria-label="${pct}% of the way from baseline to target">
          <div class="meter-track"><div class="meter-fill" style="width:${Math.min(100, pct)}%"></div></div>
          <div class="meter-scale">
            <span>${esc(num(o.baseline))}${esc(o.unit || "")} <i>baseline</i></span>
            <span class="meter-now">${esc(num(o.current))}${esc(o.unit || "")} now</span>
            <span>${esc(num(o.target))}${esc(o.unit || "")} <i>target</i></span>
          </div>
        </div>`}
        ${o.note ? `<div class="o-note">${esc(o.note)}</div>` : ""}
      </div>`;
    }).join("")}</div>
  </div>`;
}

/* Adoption is a proportion of what they already pay for — the honest leading indicator. */
function products(a) {
  if (!a.products.length) return "";
  return `<div>
    <div class="zone-label">Adoption${a.usage?.source ? ` · from ${esc(a.usage.source)}${a.usage.updated ? ", " + esc(a.usage.updated) : ""}` : ""}</div>
    <div class="prods">${a.products.map((p) => {
      const pct = adoption(p);
      return `<div class="prod" data-id="${esc(p.id)}">
        <div class="p-top"><span class="p-name">${esc(p.name)}</span>
          ${pct === null ? "" : `<span class="p-pct">${pct}%</span>`}</div>
        ${pct === null ? "" : `<div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div class="p-sub">${esc(p.active)} of ${esc(p.licensed)} ${esc(p.unit || "seats")} active</div>`}
        ${p.note ? `<div class="p-note">${esc(p.note)}</div>` : ""}
      </div>`;
    }).join("")}</div>
  </div>`;
}

function pipeline(a) {
  if (!a.pipeline.length) return "";
  return `<div>
    <div class="zone-label">In flight &amp; whitespace</div>
    <div class="pipes">${a.pipeline.map((p) => `
      <div class="pipe" data-id="${esc(p.id)}" data-kind="${esc(p.kind || "deal")}" data-stage="${esc(p.stage || "")}">
        <div class="pi-top">
          <span class="pi-kind">${p.kind === "whitespace" ? "Whitespace" : "Deal"}</span>
          ${p.value ? `<span class="pi-value">${esc(p.value)}</span>` : ""}
        </div>
        <div class="pi-name">${esc(p.name)}</div>
        <div class="pi-meta">${esc(STAGE_LABEL[p.stage] || p.stage || "")}${p.close ? " · " + esc(p.close) : ""}</div>
        ${p.note ? `<div class="pi-note">${esc(p.note)}</div>` : ""}
        ${p.deal ? `<div class="pi-link">deal map: ${esc(p.deal)}</div>` : ""}
      </div>`).join("")}</div>
  </div>`;
}

function plan(a) {
  if (!a.plan.length) return "";
  return `<div>
    <div class="zone-label">Realisation plan</div>
    <div class="rail">${a.plan.map((t) => `
      <div class="tick" data-id="${esc(t.id)}" data-flag="${t.flag ? 1 : 0}" data-win="${t.win ? 1 : 0}">
        <div class="t-date">${esc(t.date || "")}</div>
        <div class="t-label">${esc(t.label)}</div>
        ${t.owner ? `<div class="t-owner">${esc(t.owner)}</div>` : ""}
      </div>`).join("")}</div>
  </div>`;
}

/* Economics are single headline numbers — stat tiles, not a plot. */
function economics(a) {
  const tiles = a.economics.tiles || [];
  if (!tiles.length && !a.economics.note) return "";
  return `<div>
    <div class="zone-label">Economics</div>
    <div class="econs">${tiles.map((t) => `
      <div class="econ" data-id="${esc(t.label)}">
        <div class="e-value">${esc(t.value)}</div>
        <div class="e-label">${esc(t.label)}</div>
        ${t.sub ? `<div class="e-sub">${esc(t.sub)}</div>` : ""}
      </div>`).join("")}</div>
    ${a.economics.note ? `<div class="econ-note">${esc(a.economics.note)}</div>` : ""}
  </div>`;
}

export const ACCOUNT_ZONE_MAP = [[".outcome", "outcomes"], [".prod", "products"],
                                 [".pipe", "pipeline"], [".tick", "plan"], [".econ", "economics"]];

export function renderAccount({ account, brand, presenter, artifact = false, assets }) {
  const a = account;
  return renderShell({
    meta: { ...a.meta, dealName: a.meta.account },
    steps: a.steps,
    metrics: (a.economics.tiles || []).slice(0, 4),
    brand, presenter, assets, artifact,
    title: `${a.meta.account} Value Plan`,
    bar: accountbar(a),
    zonesHtml: [outcomes(a), products(a), pipeline(a), plan(a), economics(a)].join("\n      "),
    zoneMap: ACCOUNT_ZONE_MAP,
    edges: []
  });
}
