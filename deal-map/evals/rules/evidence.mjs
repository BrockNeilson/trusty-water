// Interviewers believe numbers. They discount adjectives.
export const id = "evidence";
export const about = "Claims carry numbers; language stays concrete.";

const HAS_NUM = /\d/;
const VAGUE = ["synergy", "leverage", "best-in-class", "world-class", "seamless", "robust",
  "cutting-edge", "game-chang", "very ", "really ", "a lot of", "significant", "many stakeholders", "touch base"];

export function run(d) {
  const f = [];
  const all = d.steps.flatMap((s) => (s.bullets || []).map((b) => ({ b, s })));
  const withNum = all.filter((x) => HAS_NUM.test(x.b)).length;
  if (all.length && withNum / all.length < 0.3)
    f.push({ level: "warn", at: "steps", msg: `only ${withNum}/${all.length} bullets carry a number — the story will sound like opinion` });

  const result = d.steps.find((s) => s.beat === "result");
  if (result && !(result.bullets || []).some((b) => HAS_NUM.test(b)) && !HAS_NUM.test(result.title))
    f.push({ level: "error", at: `step ${result.id}`, msg: "the result step has no number in it" });

  for (const { b, s } of all) {
    const hit = VAGUE.find((v) => b.toLowerCase().includes(v));
    if (hit) f.push({ level: "warn", at: `step ${s.id}`, msg: `"${hit.trim()}" is filler: "${b}"` });
  }
  if (!(d.metrics || []).length) f.push({ level: "warn", at: "metrics", msg: "no metric tiles — the result step has nothing to land on" });
  if ((d.metrics || []).length > 4) f.push({ level: "warn", at: "metrics", msg: `${d.metrics.length} metric tiles — four is the most an audience reads at a glance` });
  for (const m of d.metrics || []) {
    if (String(m.value || "").length > 12)
      f.push({ level: "warn", at: `metric "${m.label}"`, msg: `value "${m.value}" is too long to read big — shorten it` });
    if (!HAS_NUM.test(String(m.value)) && !HAS_NUM.test(String(m.sub || "")))
      f.push({ level: "warn", at: `metric "${m.label}"`, msg: "no number in the tile — it will read as a slogan" });
  }
  if (!d.meta?.acv) f.push({ level: "warn", at: "meta", msg: "no ACV — the first question will be how big the deal was" });
  if (!d.meta?.cycleDays) f.push({ level: "warn", at: "meta", msg: "no cycle length — the second question will be how long it took" });
  return f;
}
