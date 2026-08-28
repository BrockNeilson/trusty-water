// Local dashboard server. No dependencies — node:http plus the filesystem.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { loadDeal, loadBrand, validateDeal, normalize } from "./schema.mjs";
import { render } from "./render.mjs";
import { auditBrand, contrast } from "./theme.mjs";
import { evaluate } from "../evals/run.mjs";
import { dashboardPage } from "./dashboard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  deals: path.join(root, "data", "deals"),
  brands: path.join(root, "data", "brands"),
  logos: path.join(root, "data", "brands", "logos"),
  notes: path.join(root, "data", "notes"),
  presenter: path.join(root, "data", "presenter.json"),
  dist: path.join(root, "dist")
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,48}$/;
const okSlug = (s) => SLUG.test(String(s || ""));
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n");
const listJson = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

const MAX_BODY = 4 * 1024 * 1024;

function send(res, code, body, type = "application/json", extra = {}) {
  const payload = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(code, { "content-type": type + (type.startsWith("text") || type.includes("json") ? "; charset=utf-8" : ""), "cache-control": "no-store", ...extra });
  res.end(payload);
}
const fail = (res, code, msg) => send(res, code, { error: msg });

function body(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on("data", (c) => {
      n += c.length;
      if (n > MAX_BODY) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

// ---------- summaries ----------

function dealSummary(slug) {
  const file = path.join(P.deals, `${slug}.json`);
  const raw = readJson(file);
  const d = normalize(raw);
  const errors = validateDeal(d).filter((i) => i.level === "error").length;
  const notesFile = path.join(P.notes, `${slug}.md`);
  const notes = fs.existsSync(notesFile) ? fs.statSync(notesFile) : null;
  return {
    slug,
    dealName: d.meta.dealName || slug,
    customer: d.meta.customer || "",
    industry: d.meta.industry || "",
    acv: d.meta.acv || "",
    outcome: d.meta.outcome || "",
    cycleDays: d.meta.cycleDays || null,
    oneLiner: d.meta.oneLiner || "",
    draft: !!d.meta.draft,
    brand: d.meta.brand || "default",
    shareUrl: d.meta.shareUrl || "",
    steps: (d.steps || []).length,
    stakeholders: (d.stakeholders || []).length,
    obstacles: (d.obstacles || []).length,
    targetMinutes: d.meta.targetMinutes || 6,
    structuralErrors: errors,
    hasNotes: !!notes,
    notesWords: notes ? fs.readFileSync(notesFile, "utf8").trim().split(/\s+/).filter(Boolean).length : 0,
    updated: fs.statSync(file).mtime.toISOString()
  };
}

function brandSummary(id) {
  const b = loadBrand(P.brands, id);
  return {
    id, company: b.company || "", wordmark: b.wordmark || "", logo: b.logo || null,
    hasLogoFile: !!b._logoData, preparedForLabel: b.preparedForLabel || "Prepared for",
    accent: b.accent, accent2: b.accent2, bg: b.bg, surface: b.surface, ink: b.ink, font: b.font || "Inter",
    contrast: { accent: contrast(b.accent, b.bg), ink: contrast(b.ink, b.bg) },
    issues: auditBrand(b)
  };
}

function state() {
  return {
    presenter: readJson(P.presenter),
    deals: listJson(P.deals).map(dealSummary).sort((a, b) => b.updated.localeCompare(a.updated)),
    brands: listJson(P.brands).map(brandSummary)
  };
}

// ---------- deck ----------

function buildDeck(slug, brandId, artifact = false) {
  const deal = loadDeal(path.join(P.deals, `${slug}.json`));
  const brand = loadBrand(P.brands, brandId || deal.meta.brand || "default");
  const presenter = readJson(P.presenter);
  return render({ deal, brand, presenter, artifact });
}

const BLANK = (slug, name) => ({
  meta: {
    slug, draft: true, dealName: name, customer: name, industry: "", product: "",
    acv: "", tcv: "", termMonths: null, cycleDays: null, outcome: "", closedDate: "",
    oneLiner: "", targetMinutes: 6, brand: "default"
  },
  metrics: [],
  stakeholders: [],
  obstacles: [],
  meddpicc: {},
  timeline: [],
  steps: [{
    id: "s1", beat: "setup", kicker: "The account", title: "Start here",
    bullets: ["Write your notes first", "Then generate this deal"], spotlight: {},
    notes: "Replace this step once the notes are written."
  }]
});

// ---------- routes ----------

const routes = [
  ["GET", /^\/$/, (req, res) => send(res, 200, dashboardPage(), "text/html")],

  ["GET", /^\/api\/state$/, (req, res) => send(res, 200, state())],

  ["POST", /^\/api\/deals$/, async (req, res) => {
    const b = await body(req);
    const slug = String(b.slug || "").toLowerCase().trim();
    if (!okSlug(slug)) return fail(res, 400, "Use lowercase letters, numbers and dashes.");
    const file = path.join(P.deals, `${slug}.json`);
    if (fs.existsSync(file)) return fail(res, 409, `A deal called "${slug}" already exists.`);
    const name = String(b.dealName || slug).slice(0, 80);
    writeJson(file, BLANK(slug, name));
    fs.mkdirSync(P.notes, { recursive: true });
    const notes = path.join(P.notes, `${slug}.md`);
    if (!fs.existsSync(notes)) {
      const tpl = fs.readFileSync(path.join(P.notes, "_template.md"), "utf8");
      fs.writeFileSync(notes, tpl.replace("<Customer>", name));
    }
    send(res, 201, dealSummary(slug));
  }],

  ["GET", /^\/api\/deals\/([a-z0-9-]+)$/, async (req, res, [slug]) => {
    const file = path.join(P.deals, `${slug}.json`);
    if (!fs.existsSync(file)) return fail(res, 404, "No such deal.");
    const notesFile = path.join(P.notes, `${slug}.md`);
    send(res, 200, {
      summary: dealSummary(slug),
      deal: readJson(file),
      notes: fs.existsSync(notesFile) ? fs.readFileSync(notesFile, "utf8") : ""
    });
  }],

  ["PUT", /^\/api\/deals\/([a-z0-9-]+)$/, async (req, res, [slug]) => {
    const file = path.join(P.deals, `${slug}.json`);
    if (!fs.existsSync(file)) return fail(res, 404, "No such deal.");
    const b = await body(req);
    let incoming = b.deal;
    if (typeof incoming === "string") {
      try { incoming = JSON.parse(incoming); }
      catch (e) { return fail(res, 400, `That is not valid JSON: ${e.message}`); }
    }
    if (!incoming || typeof incoming !== "object") return fail(res, 400, "Nothing to save.");
    const issues = validateDeal(normalize(incoming));
    const errors = issues.filter((i) => i.level === "error");
    if (errors.length && !b.force) {
      return fail(res, 422, errors.map((e) => `${e.where || ""} ${e.msg}`.trim()).join("\n"));
    }
    incoming.meta = incoming.meta || {};
    incoming.meta.slug = slug;
    writeJson(file, incoming);
    send(res, 200, { summary: dealSummary(slug), warnings: issues.filter((i) => i.level === "warn") });
  }],

  ["DELETE", /^\/api\/deals\/([a-z0-9-]+)$/, async (req, res, [slug]) => {
    const file = path.join(P.deals, `${slug}.json`);
    if (!fs.existsSync(file)) return fail(res, 404, "No such deal.");
    fs.rmSync(file);
    send(res, 200, { deleted: slug, notesKept: fs.existsSync(path.join(P.notes, `${slug}.md`)) });
  }],

  ["PUT", /^\/api\/notes\/([a-z0-9-]+)$/, async (req, res, [slug]) => {
    if (!okSlug(slug)) return fail(res, 400, "Bad slug.");
    const b = await body(req);
    fs.mkdirSync(P.notes, { recursive: true });
    fs.writeFileSync(path.join(P.notes, `${slug}.md`), String(b.notes ?? ""));
    send(res, 200, { saved: true, words: String(b.notes ?? "").trim().split(/\s+/).filter(Boolean).length });
  }],

  ["GET", /^\/api\/check\/([a-z0-9-]+)$/, async (req, res, [slug], url) => {
    const file = path.join(P.deals, `${slug}.json`);
    if (!fs.existsSync(file)) return fail(res, 404, "No such deal.");
    const deal = loadDeal(file);
    const brandId = url.searchParams.get("brand") || deal.meta.brand || "default";
    const out = await evaluate(deal, { brand: loadBrand(P.brands, brandId), presenter: readJson(P.presenter) });
    send(res, 200, out);
  }],

  ["POST", /^\/api\/brands$/, async (req, res) => {
    const b = await body(req);
    const id = String(b.id || "").toLowerCase().trim();
    if (!okSlug(id)) return fail(res, 400, "Use lowercase letters, numbers and dashes.");
    const file = path.join(P.brands, `${id}.json`);
    if (fs.existsSync(file)) return fail(res, 409, `An audience called "${id}" already exists.`);
    const company = String(b.company || id).slice(0, 60);
    writeJson(file, {
      id, company, wordmark: company, logo: null, preparedForLabel: "Prepared for",
      accent: b.accent || "#5B8DEF", accent2: b.accent2 || "#9B7BF0",
      bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5", font: "Inter"
    });
    send(res, 201, brandSummary(id));
  }],

  ["PUT", /^\/api\/brands\/([a-z0-9-]+)$/, async (req, res, [id]) => {
    const file = path.join(P.brands, `${id}.json`);
    if (!fs.existsSync(file)) return fail(res, 404, "No such audience.");
    const b = await body(req);
    const cur = readJson(file);
    const FIELDS = ["company", "wordmark", "preparedForLabel", "accent", "accent2", "bg", "surface", "ink", "font"];
    for (const k of FIELDS) if (k in b) cur[k] = String(b[k] ?? "").slice(0, 120);
    for (const k of ["accent", "accent2", "bg", "surface", "ink"]) {
      if (cur[k] && !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(cur[k])) return fail(res, 400, `${k} must be a hex colour.`);
    }
    writeJson(file, cur);
    send(res, 200, brandSummary(id));
  }],

  ["POST", /^\/api\/brands\/([a-z0-9-]+)\/logo$/, async (req, res, [id]) => {
    const file = path.join(P.brands, `${id}.json`);
    if (!fs.existsSync(file)) return fail(res, 404, "No such audience.");
    const b = await body(req);
    const cur = readJson(file);
    if (b.clear) {
      cur.logo = null; writeJson(file, cur);
      return send(res, 200, brandSummary(id));
    }
    const m = /^data:(image\/(png|jpeg|svg\+xml|webp));base64,(.+)$/.exec(String(b.dataUrl || ""));
    if (!m) return fail(res, 400, "Use a PNG, JPEG, WebP or SVG file.");
    const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/svg+xml": ".svg", "image/webp": ".webp" }[m[1]];
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 1.5 * 1024 * 1024) return fail(res, 413, "Logo is over 1.5 MB — it gets inlined into every deck.");
    fs.mkdirSync(P.logos, { recursive: true });
    for (const old of [".png", ".jpg", ".svg", ".webp"]) {
      const p = path.join(P.logos, `${id}${old}`);
      if (fs.existsSync(p)) fs.rmSync(p);
    }
    fs.writeFileSync(path.join(P.logos, `${id}${ext}`), buf);
    cur.logo = `logos/${id}${ext}`;
    writeJson(file, cur);
    send(res, 200, brandSummary(id));
  }],

  ["PUT", /^\/api\/presenter$/, async (req, res) => {
    const b = await body(req);
    const cur = readJson(P.presenter);
    for (const k of ["name", "title", "tagline", "email", "initials"]) {
      if (k in b) cur[k] = String(b[k] ?? "").slice(0, 80);
    }
    writeJson(P.presenter, cur);
    send(res, 200, cur);
  }],

  ["GET", /^\/api\/logo-preview$/, (req, res, _m, url) => {
    const id = String(url.searchParams.get("brand") || "");
    if (!okSlug(id)) return fail(res, 400, "Bad audience id.");
    const brand = loadBrand(P.brands, id);
    if (!brand._logoData) return fail(res, 404, "No logo.");
    const m = /^data:([^;]+);base64,(.+)$/.exec(brand._logoData);
    res.writeHead(200, { "content-type": m[1], "cache-control": "no-store" });
    res.end(Buffer.from(m[2], "base64"));
  }],

  // Live deck, rendered on request so edits show up on reload.
  ["GET", /^\/deck\/([a-z0-9-]+)$/, (req, res, [slug], url) => {
    if (!fs.existsSync(path.join(P.deals, `${slug}.json`))) return fail(res, 404, "No such deal.");
    send(res, 200, buildDeck(slug, url.searchParams.get("brand")), "text/html");
  }],

  // Share: the self-contained file, as a download.
  ["GET", /^\/download\/([a-z0-9-]+)$/, (req, res, [slug], url) => {
    if (!fs.existsSync(path.join(P.deals, `${slug}.json`))) return fail(res, 404, "No such deal.");
    const brandId = url.searchParams.get("brand") || "default";
    const name = `${slug}${brandId === "default" ? "" : "-" + brandId}.html`;
    send(res, 200, buildDeck(slug, brandId), "text/html", {
      "content-disposition": `attachment; filename="${name}"`
    });
  }],

  // Share: write both forms to dist/ and report the paths.
  ["POST", /^\/api\/share\/([a-z0-9-]+)$/, async (req, res, [slug]) => {
    if (!fs.existsSync(path.join(P.deals, `${slug}.json`))) return fail(res, 404, "No such deal.");
    const b = await body(req);
    const brandId = b.brand || "default";
    fs.mkdirSync(P.dist, { recursive: true });
    const base = `${slug}${brandId === "default" ? "" : "-" + brandId}`;
    const standalone = path.join(P.dist, `${base}.html`);
    const artifact = path.join(P.dist, `${base}.artifact.html`);
    fs.writeFileSync(standalone, buildDeck(slug, brandId, false));
    fs.writeFileSync(artifact, buildDeck(slug, brandId, true));
    if (typeof b.shareUrl === "string") {
      const f = path.join(P.deals, `${slug}.json`);
      const d = readJson(f);
      d.meta = d.meta || {};
      d.meta.shareUrl = b.shareUrl.slice(0, 300);
      writeJson(f, d);
    }
    send(res, 200, { standalone, artifact, brand: brandId, bytes: fs.statSync(standalone).size });
  }]
];

export function serve({ port = 4173, host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      for (const [method, re, handler] of routes) {
        if (req.method !== method) continue;
        const m = re.exec(url.pathname);
        if (!m) continue;
        return await handler(req, res, m.slice(1), url);
      }
      fail(res, 404, "Not found.");
    } catch (e) {
      fail(res, 500, e && e.message ? e.message : String(e));
    }
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${port}` }));
  });
}
