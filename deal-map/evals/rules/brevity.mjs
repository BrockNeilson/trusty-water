// A bullet you can't say in one breath is a bullet you'll read aloud.
export const id = "brevity";
export const about = "Copy is short enough to speak, not read.";

const LIMITS = { title: 6, bullet: 10, kicker: 3, bullets: 3, headline: 7 };
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

export function run(d) {
  const f = [];
  d.steps.forEach((s, i) => {
    const at = `steps[${i}] ${s.id || ""}`.trim();
    if (words(s.title) > LIMITS.title)
      f.push({ level: "error", at, msg: `title is ${words(s.title)} words (max ${LIMITS.title}): "${s.title}"` });
    if (words(s.kicker) > LIMITS.kicker)
      f.push({ level: "warn", at, msg: `kicker is ${words(s.kicker)} words (max ${LIMITS.kicker})` });
    if ((s.bullets || []).length > LIMITS.bullets)
      f.push({ level: "error", at, msg: `${s.bullets.length} bullets (max ${LIMITS.bullets}) — the eye stops reading at three` });
    (s.bullets || []).forEach((b, n) => {
      if (words(b) > LIMITS.bullet)
        f.push({ level: "error", at: `${at}.bullets[${n}]`, msg: `${words(b)} words (max ${LIMITS.bullet}): "${b}"` });
      if (/[.!]$/.test(b.trim()))
        f.push({ level: "warn", at: `${at}.bullets[${n}]`, msg: "bullets read tighter without terminal punctuation" });
    });
  });
  for (const [k, m] of Object.entries(d.meddpicc || {})) {
    if (m?.headline && words(m.headline) > LIMITS.headline)
      f.push({ level: "warn", at: `meddpicc.${k}`, msg: `headline is ${words(m.headline)} words (max ${LIMITS.headline})` });
  }
  for (const o of d.obstacles || []) {
    if (words(o.title) > 4) f.push({ level: "warn", at: `obstacle ${o.id}`, msg: `title is ${words(o.title)} words (max 4)` });
  }
  return f;
}
