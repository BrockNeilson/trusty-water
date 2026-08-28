// Brand -> CSS custom properties, plus contrast math the evals reuse.

const hex = (c) => {
  const m = String(c || "").trim().replace(/^#/, "");
  const s = m.length === 3 ? m.split("").map((x) => x + x).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(a, b) {
  const ra = hex(a), rb = hex(b);
  if (!ra || !rb) return null;
  const la = lum(ra), lb = lum(rb);
  return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toFixed(2));
}

export const isHex = (c) => !!hex(c);

export function themeVars(brand) {
  const v = {
    "--accent": brand.accent || "#5B8DEF",
    "--accent2": brand.accent2 || brand.accent || "#9B7BF0",
    "--bg": brand.bg || "#0B0E14",
    "--surface": brand.surface || "#141922",
    "--ink": brand.ink || "#E8EDF5",
    "--font": `'${brand.font || "Inter"}'`
  };
  return `:root{\n${Object.entries(v).map(([k, val]) => `  ${k}:${val};`).join("\n")}\n}`;
}

// Readability checks a brand must pass before it goes on a screen in an interview.
export function auditBrand(brand) {
  const out = [];
  const bg = brand.bg || "#0B0E14";
  const ink = brand.ink || "#E8EDF5";
  const accent = brand.accent || "#5B8DEF";
  for (const [name, value] of Object.entries({ bg, ink, accent, accent2: brand.accent2 })) {
    if (value && !isHex(value)) out.push({ level: "error", msg: `brand.${name} "${value}" is not a hex colour` });
  }
  const cInk = contrast(ink, bg);
  const cAccent = contrast(accent, bg);
  if (cInk !== null && cInk < 7) out.push({ level: "warn", msg: `ink/bg contrast ${cInk}:1 (want >= 7 for body copy)` });
  if (cAccent !== null && cAccent < 4.5) out.push({ level: "warn", msg: `accent/bg contrast ${cAccent}:1 (want >= 4.5 — accent is used for headings and chips)` });
  if (!brand.company && brand.id !== "default") out.push({ level: "warn", msg: "brand.company is empty — the co-brand lockup will look unfinished" });
  if (brand._logoMissing) out.push({ level: "warn", msg: `logo file not found at ${brand._logoMissing} — falling back to the wordmark` });
  return out;
}
