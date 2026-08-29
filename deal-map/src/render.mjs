// Node wrapper: reads the deck assets off disk, then hands them to the pure renderer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render as renderPure } from "./core/render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (f) => fs.readFileSync(path.join(here, "assets", f), "utf8");

export const deckAssets = () => ({ css: asset("styles.css"), js: asset("app.js") });

export function render(opts) {
  return renderPure({ ...opts, assets: opts.assets || deckAssets() });
}
