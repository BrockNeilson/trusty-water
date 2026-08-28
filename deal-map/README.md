# Deal map

An interview-ready deal review: one screen that holds the whole enterprise deal — stakeholders,
obstacles, technical hurdles, the deal path and MEDDPICC — that you step through as a story.

The map stays on screen the whole time. Each step lights up the two or three things you are
talking about and dims the rest, so the audience always knows where they are in a deal they
have never seen. You talk; you do not read.

```
data/deals/<slug>.json   the story and the map
data/brands/<id>.json    who it is prepared for
data/presenter.json      you
        ↓
dist/<slug>-<id>.html    one self-contained file. No server, no network, no build step at runtime.
```

## Use it

```bash
cd deal-map
node bin/dealmap.mjs list                              # what exists
node bin/dealmap.mjs check --deal northwind            # run the evals
node bin/dealmap.mjs build --deal northwind --brand brex
open dist/northwind-brex.html
```

Keys while presenting:

| | |
|---|---|
| `←` `→` `space` | step |
| `1`–`9` | jump to a step |
| `N` | your presenter note for this step |
| `O` | overview — every step as a card, click to jump |
| `F` | fullscreen |

It is one HTML file. Email it, put it on a USB stick, open it on their laptop. It renders
offline; the web font is the only network call and it falls back cleanly.

## Make it yours

The shipped `northwind` deal is a **sample**. It is marked `"draft": true`, which puts a
SAMPLE DATA badge in the header and fails the eval suite on purpose, so you cannot present it by
accident.

```bash
node bin/dealmap.mjs new --deal acme     # copies the sample as a starting shape
```

Then edit `data/deals/acme.json`:

- **`meta`** — deal name, ACV, cycle length, outcome, and `targetMinutes` (how long you get).
- **`stakeholders`** — `role` is one of `economic_buyer`, `champion`, `coach`, `technical_buyer`,
  `user_buyer`, `blocker`, `influencer`. `sentiment` (-2…2) colours the card edge, `influence`
  (1-3) weights it, `org` groups it into a lane, `reportsTo` draws the line.
- **`obstacles`** — `type` is `technical`, `political`, `legal`, `commercial`, `competitive` or
  `timing`. `resolution` is revealed when the step spotlights it.
- **`meddpicc`** — eight entries, each with a 0-3 `score`, a `headline` and a `proof` line.
- **`timeline`** — the deal path. `flag: true` marks the stall, `win: true` marks the close.
- **`steps`** — the story. Each step has a `beat`, a title, up to three bullets, a `spotlight`
  naming the ids to light up, and `notes` (yours only, behind `N`).

Set `"draft": false` when the content is genuinely yours.

## White-label it

```bash
node bin/dealmap.mjs brand brex --company "Brex" --accent '#F26D3D'
node bin/dealmap.mjs build --deal acme --brand brex
```

The header reads **your name · prepared for _Company_**. That is the whole move: their name and
one accent colour, not a costume. To use their real logo, drop the file in
`data/brands/logos/` and set `"logo": "logos/brex.svg"` — it is inlined as a data URI, so the
deck still works offline. Without a logo file it falls back to a wordmark, which looks
deliberate rather than missing.

`build-all` renders every brand at once, which is useful when you have three interviews in a week.

## The evals

`check` is what keeps the deck good as you iterate on it. It runs seven rule sets:

| rule | what it protects |
|---|---|
| `schema` | ids resolve, spotlights point at things that exist |
| `brevity` | ≤ 6-word titles, ≤ 3 bullets, ≤ 10 words each — the difference between talking and reading |
| `story-flow` | the arc is present and in order; the turn comes after the conflict |
| `meddpicc` | all eight letters scored and evidenced; flags a story that reads as luck |
| `coverage` | nothing on the map goes untold; one economic buyer; a technical hurdle exists |
| `evidence` | claims carry numbers; the result step has a number in it; no filler words |
| `timing` | estimated spoken minutes against `targetMinutes` |
| `presentability` | brand contrast, presenter notes present, draft flag cleared |

Errors fail the command (non-zero exit); warnings do not. `--json` for machine-readable output,
`--quiet` to hide the informational lines, `--no-fail` to see everything without a failing exit.

Add a rule by dropping a file in `evals/rules/` that exports `id`, `about` and
`run(deal, ctx) -> findings[]`. It is picked up automatically.

## The agents

Four agents in `.claude/agents/`, plus a `/dealmap` skill that ties them together:

- **`deal-story-coach`** — raw notes or a rambling recollection into a deal file, then tightens it.
- **`meddpicc-auditor`** — audits the qualification as a sceptical VP Sales, and hands you the
  five questions the current story invites.
- **`deck-critic`** — builds, screenshots every step in a real browser, and critiques what it
  actually looks like. It does not opine on a deck it has not seen.
- **`whitelabel-scout`** — sets up a brand for a specific interview and verifies it reads well.

## Notes on design

- The map scales to fit whatever screen it lands on. The scale is measured from the *tallest*
  step, so nothing resizes mid-story and nothing spills off a small laptop.
- Everything is one file: styles, script and logo are inlined at build time.
- Dark ground, one accent. The accent is the only colour that moves, so the eye follows it.
