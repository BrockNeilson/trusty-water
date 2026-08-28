// Composes one self-contained HTML file: deal + brand + presenter -> deck.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MEDDPICC, GATE_ICON } from "./schema.mjs";
import { themeVars } from "./theme.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (f) => fs.readFileSync(path.join(here, "assets", f), "utf8");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const sentClass = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "neu");
const roleLabel = (r) => String(r || "").replace(/_/g, " ");

function topbar(p, brand, meta) {
  const mark = brand._logoData
    ? `<img src="${brand._logoData}" alt="${esc(brand.company)}">`
    : esc(brand.wordmark || brand.company || "");
  const co = (brand.company || brand.wordmark)
    ? `<div class="cobrand">
        <span class="cobrand-label">${esc(brand.preparedForLabel || "Prepared for")}</span>
        <span class="cobrand-rule"></span>
        <span class="cobrand-mark">${mark}</span>
      </div>`
    : `<div class="cobrand"><span class="cobrand-label">${esc(brand.preparedForLabel || "Deal Review")}</span></div>`;
  const draft = meta.draft ? `<span class="badge-draft">Sample data</span>` : "";
  return `<header class="topbar">
    <div class="avatar">${esc(p.initials || (p.name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2))}</div>
    <div class="who">
      <div>
        <div class="who-name">${esc(p.name)}</div>
        <div class="who-title">${esc(p.title || "")}${p.tagline ? " · " + esc(p.tagline) : ""}</div>
      </div>
    </div>
    ${draft}
    ${co}
  </header>`;
}

function narrative(step) {
  return `<div class="kicker">${esc(step.kicker || step.beat || "")}</div>
    <h1 class="step-title">${esc(step.title)}</h1>
    <ul class="bullets">${(step.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    <div class="notes" id="notes" hidden>${step.notes ? "Note — " + esc(step.notes) : ""}</div>`;
}

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

function metricsOverlay(d) {
  if (!d.metrics.length) return "";
  return `<div class="metrics" id="metrics"><div class="metrics-grid">${d.metrics.map((m) => `
    <div class="metric"><div class="v${String(m.value || "").length > 8 ? " long" : ""}">${esc(m.value)}</div><div class="l">${esc(m.label)}</div>
    ${m.sub ? `<div class="s">${esc(m.sub)}</div>` : ""}</div>`).join("")}</div></div>`;
}

function footer(d) {
  return `<footer class="footer">
    <div class="beatmap" id="beatmap">${d.steps.map(() => "<i></i>").join("")}</div>
    <div class="navbtns">
      <button class="navbtn" id="prev" aria-label="Previous">‹</button>
      <button class="navbtn" id="next" aria-label="Next">›</button>
      <button class="navbtn" id="ovbtn" aria-label="Overview">▦</button>
    </div>
    <div class="steps" id="steps">${d.steps.map((s, n) =>
      `<button class="stepbtn" data-n="${n}">${esc(s.kicker || s.beat || s.title)}</button>`).join("")}</div>
    <div class="counter" id="counter"></div>
    <div class="keys"><kbd>←</kbd><kbd>→</kbd> step <kbd>N</kbd> notes <kbd>O</kbd> map <kbd>F</kbd> full</div>
  </footer>`;
}

export function render({ deal, brand, presenter }) {
  const d = deal;
  const title = `${d.meta.dealName} — Deal Review${brand.company ? " · " + brand.company : ""}`;
  const payload = {
    meta: d.meta,
    steps: d.steps,
    _edges: d._edges
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(brand.font || "Inter")}:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${themeVars(brand)}
${asset("styles.css")}
</style>
</head>
<body>
<div class="stage">
  ${topbar(presenter, brand, d.meta)}
  <div class="body">
    <section class="narrative anim-in" id="narrative">${narrative(d.steps[0] || { title: "" })}</section>
    <section class="map" id="map">
      <div class="map-inner" id="map-inner">
        <svg id="wires" preserveAspectRatio="none"></svg>
        ${dealbar(d)}
        ${lanes(d)}
        ${gates(d)}
        ${rail(d)}
        ${medd(d)}
      </div>
      ${metricsOverlay(d)}
    </section>
  </div>
  ${footer(d)}
</div>
<div class="overview" id="overview"></div>
<script>
const DEAL = ${JSON.stringify(payload).replace(/</g, "\\u003c")};
const BRAND = ${JSON.stringify({ id: brand.id, company: brand.company }).replace(/</g, "\\u003c")};
const PRESENTER = ${JSON.stringify(presenter).replace(/</g, "\\u003c")};
</script>
<script>
${asset("app.js")}
</script>
</body>
</html>`;
}
