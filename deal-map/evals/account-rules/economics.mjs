// The review exists to justify the spend. That needs numbers on both sides.
export const id = "economics";
export const about = "Value is tied back to money, and the renewal is named.";

export function run(a) {
  const f = [];
  const tiles = (a.economics && a.economics.tiles) || [];
  if (!tiles.length) f.push({ level: "error", at: "economics", msg: "no economics — the review cannot answer 'was it worth it'" });
  if (tiles.length > 4) f.push({ level: "warn", at: "economics", msg: `${tiles.length} tiles — four is the most an audience reads at once` });
  for (const t of tiles) {
    if (!/\d/.test(String(t.value))) f.push({ level: "warn", at: `economics "${t.label}"`, msg: "no number in the tile" });
    if (String(t.value).length > 12) f.push({ level: "warn", at: `economics "${t.label}"`, msg: "value is too long to read big" });
  }
  if (!a.economics || !a.economics.note)
    f.push({ level: "warn", at: "economics", msg: "no note on where the realised figure comes from — you will be asked" });
  if (!a.meta.renewal) f.push({ level: "warn", at: "meta", msg: "no renewal date — that is the deadline the plan runs against" });
  if (!a.meta.arr) f.push({ level: "warn", at: "meta", msg: "no ARR — the first question is how big the account is" });

  const open = (a.pipeline || []).filter((p) => p.kind === "deal" && !String(p.stage || "").startsWith("closed"));
  const white = (a.pipeline || []).filter((p) => p.kind === "whitespace");
  f.push({ level: "info", at: "pipeline", msg: `${open.length} deal(s) in flight, ${white.length} whitespace idea(s)` });
  if (!open.length && !white.length)
    f.push({ level: "warn", at: "pipeline", msg: "nothing in flight and no whitespace — there is no forward story" });
  return f;
}
