// The things that make it look thoughtful rather than improvised.
import { auditBrand, contrast } from "../../src/core/theme.mjs";
export const id = "presentability";
export const about = "Brand lockup and stage-readiness checks.";

export function run(d, ctx) {
  const f = [];
  if (d.meta?.draft) f.push({ level: "error", at: "meta.draft", msg: 'still flagged as sample data — set meta.draft to false when the content is yours' });
  if (!d.meta?.oneLiner) f.push({ level: "warn", at: "meta", msg: "no oneLiner — the overview screen has no summary" });
  for (const s of d.steps) {
    if (!s.notes) f.push({ level: "warn", at: `step ${s.id}`, msg: "no presenter note — nothing behind the N key" });
  }
  if (ctx?.brand) {
    for (const issue of auditBrand(ctx.brand)) f.push({ level: issue.level, at: `brand.${ctx.brand.id}`, msg: issue.msg });
    if (!ctx.brand.company && ctx.brand.id !== "default")
      f.push({ level: "warn", at: `brand.${ctx.brand.id}`, msg: "no company name to co-brand with" });
    const c = contrast(ctx.brand.accent, ctx.brand.bg);
    if (c !== null) f.push({ level: "info", at: `brand.${ctx.brand.id}`, msg: `accent contrast ${c}:1` });
  }
  if (ctx?.presenter && !ctx.presenter.name)
    f.push({ level: "error", at: "presenter", msg: "presenter.name is empty — your name is the one thing that must be on screen" });
  return f;
}
