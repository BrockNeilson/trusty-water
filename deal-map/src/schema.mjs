// Filesystem loaders. The rules and shapes live in core/deal.mjs so the browser can use them too.
import fs from "node:fs";
import path from "node:path";
import { normalize } from "./core/deal.mjs";

export * from "./core/deal.mjs";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

export function loadDeal(file) {
  return normalize(readJson(file));
}

export function loadBrand(dir, id) {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) {
    const avail = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    throw new Error(`Unknown brand "${id}". Available: ${avail.join(", ")}`);
  }
  const brand = readJson(file);
  if (brand.logo) {
    const lp = path.join(dir, brand.logo);
    brand._logoData = fs.existsSync(lp) ? inlineImage(lp) : null;
    if (!brand._logoData) brand._logoMissing = lp;
  }
  return brand;
}

export function inlineImage(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
                 ".jpeg": "image/jpeg", ".webp": "image/webp" }[ext];
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}
