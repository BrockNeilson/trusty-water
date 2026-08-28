# Deal map

An interview-ready deal review: one screen that holds the whole enterprise deal — stakeholders,
obstacles, technical hurdles, the deal path and MEDDPICC — that you step through as a story.

The map stays on screen the whole time. Each step lights up the two or three things you are
talking about and dims the rest, so the audience always knows where they are in a deal they
have never seen. You talk; you do not read.

```
dealmap serve            ← the desk: every deal, click in to edit, brand, check, share
        ↓
data/notes/<slug>.md     ← you write here. Prose, fragments, a pasted transcript.
        ↓                  deal-story-coach reads it and writes:
data/deals/<slug>.json     the structured deal — people, obstacles, MEDDPICC, and the steps
data/brands/<id>.json      who it is prepared for
data/presenter.json        you
        ↓                  node bin/dealmap.mjs build
dist/<slug>-<id>.html      one self-contained file. No server, no network, no runtime build.
```

## The local desk

One layer above a deal is the desk: every deal as a card, click into one to write it, brand it,
check it and send it. The preview renders at 1280×720 — the size a shared screen actually is.

```bash
cd deal-map
node bin/dealmap.mjs serve          # http://127.0.0.1:4173
```

It is a local server, not a static page, because creating a deal and editing notes, colours and
logos all write real files under `data/`. Nothing leaves the machine, and every edit is a normal
file change you can diff and commit.

From a deal card you get four tabs and a live preview rendered at 1440×900 — the size an
interviewer's laptop actually is, scaled down, so what you see is what they will see:

| tab | what it edits |
|---|---|
| **Notes** | `data/notes/<slug>.md` — autosaves as you type |
| **Story** | `data/deals/<slug>.json` — refuses to save invalid JSON or a broken reference, and tells you which |
| **Audience** | the white-label: company, wordmark, label, logo (drag and drop), and the five-colour scheme with a live contrast readout |
| **Checks** | the eval suite, inline, with the score |

**New deal** creates the deal file and its notes file together. **Share** offers the two honest
options: download the self-contained HTML to email or carry on a stick, or write both forms to
`dist/` and publish the `.artifact.html` as a link, which you paste back so the desk keeps it
with the deal. **Delete** removes the deal file and keeps your notes.

Switching the audience on a deal stores it as `meta.brand`, so `dealmap build` with no `--brand`
renders the version you last chose on the desk.

## Use it from the terminal

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
| `Z` | pull back to the whole map for a beat, then press again to return |
| `N` | your presenter note for this step |
| `O` | overview — every step as a card, click to jump |
| `F` | fullscreen |

### Why the map scrolls

The deck is sized for a **1280×720 shared screen** — the compressed Zoom or Meet share, which is
the realistic worst case. At that size nothing on the map is smaller than 12px, and the things
you actually read aloud are 14-17px.

That does not fit on one screen, and it should not: an earlier version scaled the whole map down
to fit and produced 7px text, which no one on a screen share could read. So the map is rendered
at full size and **scrolls**, and each step scrolls it to the part of the map that step is about.
Your audience never scrolls — the deck does it for them.

When a step lights up more than one zone, `spotlight.focus` says which one the map should land
on (`stakeholders`, `obstacles`, `timeline` or `meddpicc`). The `coverage` eval warns when a step
spans three or more zones without naming a focus, because that is a step the map cannot land
cleanly on. Press `Z` any time you want to say "here is the whole deal" — it pulls back to the
full map, spotlight intact.

It is one HTML file. Email it, put it on a USB stick, open it on their laptop. It renders
offline; the web font is the only network call and it falls back cleanly.

## The hosted desk

`node bin/dealmap.mjs hosted` builds a single page that is the whole desk — the deals, the
renderer, the evals and the editor — which is then published as an Artifact and opened from
anywhere, phone included.

**How it persists.** There is no database. The page carries your data inside itself and a
base64 copy of its own template; pressing **Save** regenerates the document with the new data
and republishes it. That has three consequences worth knowing before you rely on it:

- **Saving is explicit.** Every save republishes and reloads every open view, so it would be
  hostile to do it on every keystroke. Edits are held locally (and mirrored to this device's
  storage, so a reload offers to restore them) until you press Save.
- **Last write wins.** If two views save against the same version, the second is refused and
  that view reloads to the winner. For one person on two devices this is rare; it is not a
  collaborative editor.
- **Anyone you share the page with sees every deal on it.** Share a *deck* for feedback, not
  the desk.

People without write access get a read-only desk: they can read the deals and comment, but
Save is hidden and every field is disabled.

**Getting the data back into the repo.** Share → *Export all data* writes a JSON file with the
same shape as `data/`, and `node bin/dealmap.mjs import <file>` writes it back:

```bash
node bin/dealmap.mjs import ~/Downloads/deal-desk-export.json --dry-run   # see what would change
node bin/dealmap.mjs import ~/Downloads/deal-desk-export.json             # then git diff
```

The repo stays the archive; the hosted desk is where you work when you are not at your machine.
They do not sync on their own — export and import are the bridge.

## How a story becomes the deck

The input is prose. You do not write JSON.

```bash
node bin/dealmap.mjs intake acme --company "Acme Freight"   # creates data/notes/acme.md
```

That file is an interview with yourself: the account, the pain and its number, every person who
mattered and what *they* were measured on, where it went wrong, the turn, the hurdles, the close,
the outcome, the lesson. Write badly in it. Paste a CRM export or a transcript of you talking it
through out loud. Leave blanks — a blank is information, it shows where the story is thin.

Then hand it over:

> "Turn my acme notes into a deal"

The `deal-story-coach` agent reads `data/notes/acme.md` and writes `data/deals/acme.json`. It
asks you about anything material that is missing rather than inventing it — **every number in the
deck traces back to a line in your notes.** Then it runs the evals and tightens the copy until
they pass.

`data/notes/northwind.md` is the worked example: the notes the sample deal was generated from, so
you can see the whole translation.

### What the translation actually does

| your notes | becomes | why |
|---|---|---|
| the people and who they answered to | `stakeholders`, with roles, sentiment, influence, reporting lines | the map — the lanes and the connectors |
| "it stalled in July, procurement re-opened the renewal" | `obstacles` + a flagged point on the `timeline` | the gates you cleared, and the dip in the deal path |
| the numbers, and who gave them to you | `meddpicc` scores and proof lines, `metrics` tiles | what survives an interviewer's follow-up |
| the shape of what happened | `steps` — eight beats, ≤ 6-word titles, ≤ 3 bullets | what you actually say out loud |
| the parts you'd say but not put on screen | `notes` on each step, behind the `N` key | your prompt, not the audience's reading material |

The bullets are not the story — they are the prompts for it. Everything you would say in full
sentences belongs in `notes`, where only you see it.

## Make it yours

The shipped `northwind` deal is a **sample**. It is marked `"draft": true`, which puts a
SAMPLE DATA badge in the header and fails the eval suite on purpose, so you cannot present it by
accident.

```bash
node bin/dealmap.mjs new --deal acme     # a deal file plus its notes file
```

The coach writes this file for you, but it is plain JSON and you should know what is in it:

- **`meta`** — deal name, ACV, cycle length, outcome, and `targetMinutes` (how long you get).
- **`stakeholders`** — `role` is one of `economic_buyer`, `champion`, `coach`, `technical_buyer`,
  `user_buyer`, `blocker`, `influencer`. `sentiment` (-2…2) colours the card edge, `influence`
  (1-3) weights it, `org` groups it into a lane, `reportsTo` draws the line.
- **`obstacles`** — `type` is `technical`, `political`, `legal`, `commercial`, `competitive` or
  `timing`. `resolution` is revealed when the step spotlights it.
- **`meddpicc`** — eight entries, each with a 0-3 `score`, a `headline` and a `proof` line.
- **`meta.brand`** — which audience this deal is prepared for (set by the desk's picker).
- **`timeline`** — the deal path. `flag: true` marks the stall, `win: true` marks the close.
- **`steps`** — the story. Each step has a `beat`, a title, up to three bullets, a `spotlight`
  naming the ids to light up, and `notes` (yours only, behind `N`). `spotlight.focus` names the
  zone the map should scroll to when the step lights more than one.

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

- The map is rendered at reading size and scrolled, never shrunk to fit. Legibility on a shared
  screen beats seeing every element at once — `Z` covers the moments you want the whole picture.
- Everything is one file: styles, script and logo are inlined at build time.
- Dark ground, one accent. The accent is the only colour that moves, so the eye follows it.
