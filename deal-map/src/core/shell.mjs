// The presentation shell shared by every map: top bar, narrative rail, footer,
// metric overlay and the document itself. A map supplies its own zones.
import { themeVars } from "./theme.mjs";

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


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
    <div class="keys"><kbd>←</kbd><kbd>→</kbd> step <kbd>Z</kbd> whole map <kbd>N</kbd> notes <kbd>O</kbd> steps <kbd>F</kbd> full</div>
  </footer>`;
}

export function renderShell({ meta, steps, metrics, brand, presenter, assets, artifact = false,
                              title, zonesHtml, bar, zoneMap, edges }) {
  const head = `<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(brand.font || "Inter")}:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${themeVars(brand)}
${assets.css}
</style>`;

  const payload = { meta, steps, _edges: edges || [], _zones: zoneMap };

  const body = `<div class="stage">
  ${topbar(presenter, brand, meta)}
  <div class="body">
    <section class="narrative anim-in" id="narrative">${narrative(steps[0] || { title: "" })}</section>
    <section class="map" id="map">
      <div class="edge top" id="edge-top"></div>
      <div class="edge bottom" id="edge-bottom"></div>
      <div class="map-scroll" id="map-scroll">
      <div class="map-inner" id="map-inner">
        <svg id="wires" preserveAspectRatio="none"></svg>
        ${bar}
        ${zonesHtml}
      </div>
      </div>
      ${metricsOverlay({ metrics: metrics || [] })}
    </section>
  </div>
  ${footer({ steps })}
</div>
<div class="overview" id="overview"></div>
<script>
const DEAL = ${JSON.stringify(payload).replace(/</g, "\\u003c")};
const BRAND = ${JSON.stringify({ id: brand.id, company: brand.company }).replace(/</g, "\\u003c")};
const PRESENTER = ${JSON.stringify(presenter).replace(/</g, "\\u003c")};
</script>
<script>
${assets.js}
</script>`;

  if (artifact) return `${head}\n${body}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${head}
</head>
<body>
${body}
</body>
</html>`;
}

const sentClass = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "neu");
const roleLabel = (r) => String(r || "").replace(/_/g, " ");

