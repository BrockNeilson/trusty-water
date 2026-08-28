---
name: dealmap
description: Build, review and white-label the interview deal-map deck in deal-map/. Use when the user wants to prep a deal story for an interview, add or edit a deal, brand the deck for a specific company, or check that the story still holds up.
---

# Deal map

The project lives in `deal-map/`. One deal file plus one brand file renders one self-contained
HTML deck. Read `deal-map/README.md` first if you have not this session.

## The desk

`node bin/dealmap.mjs serve` opens the dashboard over all deals (default port 4173) — cards per
deal, and per deal: Notes, Story, Audience and Checks tabs beside a live preview. It writes
files under `data/`, so anything done there is a normal commit.

Use it when the user wants to *see* their deals, create one, change who it is prepared for, drop
in a logo, or send one. Use the CLI when the work is generating or rewriting content.

## Where input comes from

Stories go in as prose at `deal-map/data/notes/<slug>.md`, never as hand-written JSON.
`node bin/dealmap.mjs intake <slug>` starts one from the template. The `deal-story-coach` agent
reads that file and generates `data/deals/<slug>.json` from it.

If the user tells you the story in chat instead, **write it into the notes file first**, then
generate the deal from it. The notes file is the source of truth for where every number came
from; a deal file with no notes behind it cannot be checked against anything later.

## The loop

Every change goes through the same three steps. Do not skip the check.

```bash
cd deal-map
node bin/dealmap.mjs check --deal <slug> --brand <brand>   # evals: content, flow, timing, brand
node bin/dealmap.mjs build --deal <slug> --brand <brand>   # -> dist/<slug>-<brand>.html
```

Then **look at it**. A deck that passes the evals can still read badly. Screenshot with headless
Chrome and Read the images (the `deck-critic` agent does this end to end).

## Common requests

| The user says | Do this |
|---|---|
| "I'm interviewing with X on Thursday" | `node bin/dealmap.mjs brand x --company "X" --accent '#HEX'`, check contrast, build |
| "Here are my notes on the Acme deal" | Save them to `data/notes/acme.md`, hand to `deal-story-coach`, run the loop |
| "I want to add a deal" | `node bin/dealmap.mjs intake <slug>`, then walk them through the notes file |
| "Does this hold up?" | `meddpicc-auditor` — it returns the questions they will actually ask |
| "It looks off / cramped / too dark" | `deck-critic` — it screenshots before it opines |
| "Make it shorter" | `check` reports estimated spoken minutes; cut bullets, not steps |

## Rules that matter

- **`meta.draft: true` fails the check on purpose.** It means the deck still shows sample data.
  Clear it only when the content is genuinely the user's.
- Titles ≤ 6 words, ≤ 3 bullets per step, ≤ 10 words per bullet. The evals enforce this; do not
  argue with it, cut the words.
- Never invent a metric, a name, or an outcome. If a number is missing, ask for it.
- The client logo goes *beside* the presenter's name under "Prepared for", never above it.
- Keys during the walkthrough: `←/→` step · `N` notes · `O` overview · `F` fullscreen · `1-9` jump.

## Before an interview

1. `node bin/dealmap.mjs check` — expect a clean run, no errors.
2. `node bin/dealmap.mjs build --brand <company>` — confirm the lockup and the accent.
3. Open the file, walk it once with `N` on, and confirm the timing estimate matches the slot.
