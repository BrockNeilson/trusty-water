// A deal review is a story: situation, complication, turn, proof, result, lesson.
import { BEATS } from "../../src/core/deal.mjs";
export const id = "story-flow";
export const about = "The steps form an arc, not a list of facts.";

const REQUIRED = ["setup", "conflict", "turn", "result"];
const ORDER = BEATS;

export function run(d) {
  const f = [];
  const beats = d.steps.map((s) => s.beat).filter(Boolean);
  for (const need of REQUIRED) {
    if (!beats.includes(need)) f.push({ level: "error", at: "steps", msg: `no "${need}" beat — without it the story has no shape` });
  }
  let last = -1;
  d.steps.forEach((s, i) => {
    const n = ORDER.indexOf(s.beat);
    if (n === -1) return;
    if (n < last) f.push({ level: "warn", at: `steps[${i}] ${s.id}`, msg: `beat "${s.beat}" comes after "${ORDER[last]}" — the arc goes backwards here` });
    last = Math.max(last, n);
  });
  if (d.steps.length < 5) f.push({ level: "warn", at: "steps", msg: `${d.steps.length} steps — under 5 the story feels thin` });
  if (d.steps.length > 10) f.push({ level: "error", at: "steps", msg: `${d.steps.length} steps — over 10 you will run out of interview time` });

  const conflict = d.steps.find((s) => s.beat === "conflict");
  const turn = d.steps.find((s) => s.beat === "turn");
  if (conflict && turn && d.steps.indexOf(turn) <= d.steps.indexOf(conflict))
    f.push({ level: "error", at: "steps", msg: "the turn lands before the conflict — nothing to turn from" });

  const lesson = d.steps[d.steps.length - 1];
  if (lesson && !["lesson", "result"].includes(lesson.beat))
    f.push({ level: "warn", at: `steps[${d.steps.length - 1}]`, msg: "the last step should land a result or a lesson — that's what they remember" });
  return f;
}
