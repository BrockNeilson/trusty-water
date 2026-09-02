// The local desk shell. Same markup, styles and UI as the hosted desk —
// only the store differs (this one writes files through the dev server).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "../bin/bundle.mjs";
import { themeVars } from "./core/theme.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (f) => fs.readFileSync(path.join(here, "assets", f), "utf8");

// The shared UI needs the same pure core the hosted desk has: normalize,
// validateDeal and contrast. Checks themselves still come from the server.
const core = () => bundle([path.join(here, "core", "deal.mjs"), path.join(here, "core", "theme.mjs")],
  { root: path.join(here, "..") });

// The desk can be skinned like anything else: presenter.json may carry a deskBrand,
// otherwise it keeps its own graphite-and-brass defaults.
function deskBrand() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(here, "..", "data", "presenter.json"), "utf8"));
    const b = p.deskBrand;
    return b && Object.keys(b).length ? b : null;
  } catch (e) { return null; }
}

// No skin means no theme block at all — an empty brand would resolve to the deck's
// defaults and quietly overwrite the desk's own identity.
const deskTheme = () => { const b = deskBrand(); return b ? `<style>${themeVars(b)}</style>` : ""; };

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
<style>${asset("desk.css")}</style>
${deskTheme()}
</head>
<body>
${asset("desk.html")}
<script>${core()}</script>
<script>${asset("store-http.js")}</script>
<script>${asset("desk-forms.js")}</script>
<script>${asset("desk-ui.js")}</script>
</body>
</html>`;
}
