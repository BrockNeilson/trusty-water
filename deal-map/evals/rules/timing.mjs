// A deal story that runs long gets cut off before the lesson.
export const id = "timing";
export const about = "Spoken length fits the interview slot.";

const WPM = 135;          // steady interview pace
const PER_STEP_PAUSE = 4; // seconds to move, breathe, let them look at the map

export function run(d) {
  const target = d.meta?.targetMinutes || 6;
  let words = 0;
  for (const s of d.steps) {
    words += count(s.title) + (s.bullets || []).reduce((a, b) => a + count(b) * 3.2, 0);
  }
  const secs = Math.round((words / WPM) * 60 + d.steps.length * PER_STEP_PAUSE);
  const mins = +(secs / 60).toFixed(1);
  const f = [{ level: "info", at: "steps", msg: `estimated ${mins} min spoken (target ${target})` }];
  if (mins > target * 1.25) f.push({ level: "error", at: "steps", msg: `runs ~${mins} min against a ${target} min target — cut a step or a bullet` });
  else if (mins > target) f.push({ level: "warn", at: "steps", msg: `slightly long at ~${mins} min` });
  if (mins < target * 0.5) f.push({ level: "warn", at: "steps", msg: `only ~${mins} min — you will finish before they are engaged` });
  return f;
}
const count = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
