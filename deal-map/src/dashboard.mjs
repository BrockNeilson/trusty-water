// The desk shell. Assets are inlined so the server has no static-file routes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (f) => fs.readFileSync(path.join(here, "assets", f), "utf8");

export function dashboardPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deal desk</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<style>${asset("dashboard.css")}</style>
</head>
<body>

<header class="top">
  <div class="brandmark">Deal<span>·</span>desk</div>
  <div class="sub" id="who">—</div>
  <div class="spacer"></div>
  <div class="sub" id="deskcount"></div>
</header>

<main id="desk">
  <div class="wrap">
    <div class="desk-head">
      <div>
        <h1>Your deals</h1>
        <p>Each one is a story you can walk an interviewer through. Click in to write it, brand it, or send it.</p>
      </div>
    </div>
    <div class="grid" id="grid"></div>
  </div>
</main>

<section class="deal" id="deal">
  <div class="pane">
    <div class="pane-head">
      <div class="crumb">
        <button class="btn ghost sm" id="back">← All deals</button>
        <h1 id="deal-name">—</h1>
      </div>
      <div class="crumb">
        <label class="sub" for="audience-pick" style="border:0;padding:0">Prepared for</label>
        <select id="audience-pick" style="width:auto;min-width:170px"></select>
        <div class="spacer" style="flex:1"></div>
        <button class="btn sm ghost danger" id="delete">Delete</button>
        <button class="btn sm" id="share">Share</button>
      </div>
    </div>
    <nav class="tabs">
      <button class="tab on" data-tab="notes">Notes</button>
      <button class="tab" data-tab="story">Story</button>
      <button class="tab" data-tab="audience">Audience</button>
      <button class="tab" data-tab="checks">Checks<span class="n" id="tab-checks-n"></span></button>
    </nav>
    <div class="panel-body" id="panel-body"></div>
  </div>

  <div class="preview">
    <div class="preview-bar">
      <span class="label">Live preview</span>
      <div class="spacer" style="flex:1"></div>
      <span class="frame-size" id="frame-size"></span>
      <button class="btn sm ghost" id="reload">Reload</button>
      <button class="btn sm" id="openfull">Open full screen ↗</button>
    </div>
    <div class="frame-wrap" id="frame-wrap">
      <div class="frame-stage" id="frame-stage"><iframe id="frame" title="Deck preview"></iframe></div>
    </div>
  </div>
</section>

<div class="scrim" id="scrim"></div>
<div class="toast" id="toast"></div>

<script>${asset("dashboard.js")}</script>
</body>
</html>`;
}
