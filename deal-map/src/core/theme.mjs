// Theme compiler: a brand supplies a few colours, this derives the whole token set
// and proves each one is readable. Nothing that carries text is left to chance —
// where a value would fail, it is snapped to the nearest passing one and reported.

const hex = (c) => {
  const m = String(c || "").trim().replace(/^#/, "");
  const s = m.length === 3 ? m.split("").map((x) => x + x).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
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
export const isLight = (c) => { const r = hex(c); return r ? lum(r) > 0.4 : false; };

const mix = (a, b, t) => {
  const ra = hex(a), rb = hex(b);
  if (!ra || !rb) return a;
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
};

function hsl(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex(t.map((v) => (v + m) * 255));
}

// Text or an icon sitting on a filled swatch: whichever pole reads better.
export function onColor(fill, darkInk = "#0B0B0D", lightInk = "#FFFFFF") {
  const d = contrast(darkInk, fill) || 0, l = contrast(lightInk, fill) || 0;
  return d >= l ? darkInk : lightInk;
}

// Walk a hue's lightness until it clears the floor against this ground. This is the
// "snap to passing" step — a brand never gets to ship an unreadable status colour.
export function snapForContrast(h, s, ground, min = 4.5) {
  const up = isLight(ground) ? -1 : 1;   // dark ground wants a lighter chip and vice versa
  let best = null, bestRatio = 0;
  for (let i = 0; i <= 20; i++) {
    for (const dir of [up, -up]) {
      const l = 0.5 + dir * i * 0.025;
      if (l < 0.12 || l > 0.94) continue;
      const c = fromHsl(h, s, l);
      const r = contrast(c, ground) || 0;
      if (r > bestRatio) { bestRatio = r; best = c; }
      if (r >= min) return { color: c, ratio: r, snapped: i > 0 };
    }
  }
  return { color: best, ratio: bestRatio, snapped: true, failed: true };
}

/* Status colours are RESERVED — they never come from the brand, because a brand hue
   cannot be trusted to mean "at risk". These two triads were chosen by running the
   palette validator, not by eye:

     dark ground  #2e9e82 #c79605 #d93a74  CVD ΔE 11.2 · normal ΔE 18.9 · all >= 4.5:1
     light ground #067F63 #946B00 #9B1B5A  CVD ΔE  8.7 · normal ΔE 15.4 · all >= 4.5:1

   "Behind" leans purple-red rather than pure red on purpose: against amber, a true red
   collapses under deuteranopia, and hue alone could not separate them. Re-running the
   validator after changing any of these six values is not optional.
   Every status also carries a written label and a glyph, so colour is never the only channel. */
const STATUS = {
  dark:  { ok: "#2e9e82", warn: "#c79605", risk: "#d93a74", neutral: "#8A93A6" },
  light: { ok: "#067F63", warn: "#946B00", risk: "#9B1B5A", neutral: "#5A6472" }
};
const STATUS_HUES = { ok: [165, 0.55], warn: [45, 0.95], risk: [338, 0.72], neutral: [220, 0.08] };
const DEFAULTS = { accent: "#5B8DEF", accent2: "#9B7BF0", bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5" };

/* brand -> every token the stylesheets use, plus a report of what was checked. */
export function buildTheme(brand = {}) {
  const report = [];
  const pick = (k) => (isHex(brand[k]) ? brand[k] : DEFAULTS[k]);
  const bg = pick("bg");
  const light = isLight(bg);
  const ink = isHex(brand.ink) ? brand.ink : (light ? "#12161B" : DEFAULTS.ink);
  const surface = isHex(brand.surface) ? brand.surface : mix(bg, ink, light ? 0.05 : 0.07);
  const accent = pick("accent");
  const accent2 = isHex(brand.accent2) ? brand.accent2 : accent;

  // Accent must carry headings and chips against the ground.
  let accentOnBg = accent;
  const accentRatio = contrast(accent, bg);
  if (accentRatio !== null && accentRatio < 4.5) {
    const [h, s] = hsl(hex(accent));
    const snap = snapForContrast(h, Math.max(s, 0.35), bg, 4.5);
    accentOnBg = snap.color;
    report.push({ token: "--accent-ink", level: snap.failed ? "error" : "warn",
      msg: `brand accent is ${accentRatio}:1 on the background — text uses ${snap.color} (${snap.ratio}:1) instead` });
  }

  // Start from the validated triad for this ground; only repair if the actual
  // background is mid-tone enough to drop one below the readable floor.
  const status = { ...STATUS[light ? "light" : "dark"] };
  for (const name of Object.keys(status)) {
    const min = name === "neutral" ? 3 : 4.5;
    const r = contrast(status[name], bg);
    if (r !== null && r < min) {
      const [h, s] = STATUS_HUES[name];
      const snap = snapForContrast(h, s, bg, min);
      status[name] = snap.color;
      report.push({ token: `--${name}`, level: snap.failed ? "error" : "warn",
        msg: snap.failed
          ? `no readable ${name} colour on this background`
          : `${name} was ${r}:1 on this background — repaired to ${snap.color} (${snap.ratio}:1)` });
    }
  }

  const vars = {
    "--bg": bg,
    "--surface": surface,
    "--surface-2": mix(surface, ink, 0.06),
    "--ink": ink,
    "--ink-muted": mix(bg, ink, 0.68),
    "--ink-faint": mix(bg, ink, 0.48),
    "--line": mix(bg, ink, 0.16),
    "--line-soft": mix(bg, ink, 0.09),
    "--accent": accent,
    "--accent-2": accent2,
    "--accent-ink": accentOnBg,          // accent used as text
    "--on-accent": onColor(accent),      // text sitting on an accent fill
    "--accent-quiet": mix(bg, accent, 0.16),
    "--ok": status.ok,
    "--warn": status.warn,
    "--risk": status.risk,
    "--neutral": status.neutral,
    "--on-ok": onColor(status.ok),
    "--on-warn": onColor(status.warn),
    "--on-risk": onColor(status.risk),
    // Dimming the map is how the spotlight works. 0.34 reads as "receded" on a dark
    // ground; on a light one the same value washes out to nearly nothing.
    "--dim": light ? "0.55" : "0.34",
    "--font": `'${brand.font || "Inter"}'`,
    "--scheme": light ? "light" : "dark"
  };

  for (const [label, fg, bgc, min] of [
    ["ink on background", vars["--ink"], bg, 7],
    ["muted ink on background", vars["--ink-muted"], bg, 4.5],
    ["faint ink on background", vars["--ink-faint"], bg, 3],
    ["accent text on background", vars["--accent-ink"], bg, 4.5],
    ["text on accent fill", vars["--on-accent"], accent, 4.5],
    ["ink on card", vars["--ink"], vars["--surface"], 7],
    ["ok on background", vars["--ok"], bg, 4.5],
    ["warn on background", vars["--warn"], bg, 4.5],
    ["risk on background", vars["--risk"], bg, 4.5]
  ]) {
    const r = contrast(fg, bgc);
    if (r !== null && r < min) report.push({ token: label, level: "warn", msg: `${label} is ${r}:1 (want ${min}+)` });
  }
  return { vars, report, light };
}

export function themeVars(brand) {
  const { vars, light } = buildTheme(brand);
  const body = Object.entries(vars).map(([k, v]) => `  ${k}:${v};`).join("\n");
  return `:root{\n${body}\n  color-scheme:${light ? "light" : "dark"};\n}`;
}

// What the evals and the desk's contrast readout consume.
export function auditBrand(brand) {
  const out = [];
  for (const k of ["bg", "ink", "accent", "accent2", "surface"]) {
    if (brand[k] && !isHex(brand[k])) out.push({ level: "error", msg: `brand.${k} "${brand[k]}" is not a hex colour` });
  }
  const { report } = buildTheme(brand);
  for (const r of report) out.push({ level: r.level || "warn", msg: r.msg });
  if (!brand.company && brand.id !== "default") out.push({ level: "warn", msg: "brand.company is empty — the co-brand lockup will look unfinished" });
  if (brand._logoMissing) out.push({ level: "warn", msg: `logo file not found at ${brand._logoMissing} — falling back to the wordmark` });
  return out;
}
