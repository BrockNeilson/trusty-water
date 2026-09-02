// The deal map: its zones, and the zone map the runtime uses to scroll to them.
import { MEDDPICC, GATE_ICON } from "./deal.mjs";
import { renderShell, esc } from "./shell.mjs";

const sentClass = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "neu");
const roleLabel = (r) => String(r || "").replace(/_/g, " ");

function lanes(d) {
  return `<div>
    <div class="zone-label">Stakeholders</div>
    <div class="lanes">${d._orgs.map((lane) => `
      <div class="lane">
        <div class="lane-name">${esc(lane.name)}</div>
        ${lane.people.map((s) => `
          <div class="node" data-id="${esc(s.id)}" data-role="${esc(s.role || "")}"
               data-sent="${sentClass(s.sentiment || 0)}" data-inf="${s.influence || 1}">
            <div class="n-name">${esc(s.name)}</div>
            <div class="n-title">${esc(s.title || "")}</div>
            <div class="n-role">${esc(roleLabel(s.role))}</div>
            ${s.note ? `<div class="n-note">${esc(s.note)}</div>` : ""}
          </div>`).join("")}
      </div>`).join("")}</div>
  </div>`;
}

function gates(d) {
  if (!d.obstacles.length) return "";
  return `<div>
    <div class="zone-label">Obstacles &amp; technical hurdles</div>
    <div class="gates">${d.obstacles.map((o) => `
      <div class="gate" data-id="${esc(o.id)}" data-status="${esc(o.status || "open")}" data-type="${esc(o.type || "")}">
        <div class="g-top">
          <span class="g-ico">${GATE_ICON[o.type] || "•"}</span>
          <span class="g-title">${esc(o.title)}</span>
        </div>
        <div class="g-detail">${esc(o.detail || "")}</div>
        ${o.resolution ? `<div class="g-res">→ ${esc(o.resolution)}</div>` : ""}
      </div>`).join("")}</div>
  </div>`;
}

function rail(d) {
  if (!d.timeline.length) return "";
  return `<div>
    <div class="zone-label">Deal path${d.meta.cycleDays ? ` · ${esc(d.meta.cycleDays)} days` : ""}</div>
    <div class="rail">${d.timeline.map((t) => `
      <div class="tick" data-id="${esc(t.id)}" data-flag="${t.flag ? 1 : 0}" data-win="${t.win ? 1 : 0}">
        <div class="t-date">${esc(t.date || "")}</div>
        <div class="t-label">${esc(t.label)}</div>
      </div>`).join("")}</div>
  </div>`;
}

function medd(d) {
  return `<div>
    <div class="zone-label">MEDDPICC</div>
    <div class="medd">${MEDDPICC.map(([key, letter, name]) => {
      const m = d.meddpicc[key] || {};
      const score = Math.max(0, Math.min(3, m.score ?? 0));
      const dots = [0, 1, 2].map((n) => `<i class="${n < score ? "on" : ""}"></i>`).join("");
      return `<div class="md" data-id="${key}" data-score="${score}">
        <div class="m-k"><span class="m-letter">${letter}</span><span class="m-dots">${dots}</span></div>
        <div class="m-name">${esc(name)}</div>
        <div class="m-head">${esc(m.headline || "—")}</div>
        ${m.proof ? `<div class="m-proof">${esc(m.proof)}</div>` : ""}
      </div>`;
    }).join("")}</div>
  </div>`;
}

function dealbar(d) {
  const m = d.meta;
  const pills = [
    m.acv && `<span class="pill">ACV ${esc(m.acv)}</span>`,
    m.termMonths && `<span class="pill">${esc(m.termMonths)}-mo term</span>`,
    m.cycleDays && `<span class="pill">${esc(m.cycleDays)}-day cycle</span>`,
    m.outcome && `<span class="pill win">${esc(m.outcome)}</span>`
  ].filter(Boolean).join("");
  return `<div class="dealbar">
    <span class="name">${esc(m.dealName)}</span>
    <span class="meta">${esc(m.industry || "")}</span>
    <span class="spacer"></span>${pills}
  </div>`;
}


export const DEAL_ZONES = [[".node", "stakeholders"], [".gate", "obstacles"],
                           [".tick", "timeline"], [".md", "meddpicc"]];

export function render({ deal, brand, presenter, artifact = false, assets }) {
  const d = deal;
  return renderShell({
    meta: d.meta, steps: d.steps, metrics: d.metrics, brand, presenter, assets, artifact,
    title: `${d.meta.dealName} Deal Map`,
    bar: dealbar(d),
    zonesHtml: [lanes(d), gates(d), rail(d), medd(d)].join("\n      "),
    zoneMap: DEAL_ZONES,
    edges: d._edges
  });
}
