// A value plan that cannot be measured is a slide, not a plan.
import { progress, adoption } from "../../src/core/account.mjs";
export const id = "value";
export const about = "Outcomes are measurable and tied to what they bought.";

export function run(a) {
  const f = [];
  if (!a.outcomes.length) f.push({ level: "error", at: "outcomes", msg: "no outcomes — there is nothing to realise" });
  if (a.outcomes.length > 5) f.push({ level: "warn", at: "outcomes", msg: `${a.outcomes.length} outcomes — an account review holds about four` });

  let measurable = 0;
  for (const o of a.outcomes) {
    const p = progress(o);
    if (p === null) f.push({ level: "error", at: `outcome ${o.id}`, msg: "needs a baseline, a current and a target to be measurable" });
    else measurable++;
    if (!o.owner) f.push({ level: "warn", at: `outcome ${o.id}`, msg: "no owner on the customer side — an outcome nobody owns does not move" });
    if (!o.metric) f.push({ level: "warn", at: `outcome ${o.id}`, msg: "no metric named — say what is actually counted" });
  }
  if (a.outcomes.length) {
    const at = a.outcomes.filter((o) => ["at_risk", "behind"].includes(o.status)).length;
    f.push({ level: "info", at: "outcomes", msg: `${measurable}/${a.outcomes.length} measurable, ${at} at risk or behind` });
    if (!at) f.push({ level: "warn", at: "outcomes", msg: "everything is green — a review with no problem in it is not believed" });
  }
  for (const p of a.products || []) {
    const pct = adoption(p);
    if (pct !== null && pct < 50) f.push({ level: "info", at: `product ${p.id}`, msg: `${pct}% adopted — the gap is the story` });
  }
  return f;
}
