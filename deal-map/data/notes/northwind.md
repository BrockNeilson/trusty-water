# Northwind Logistics — raw notes

> Worked example. This is the file the sample deal was generated from — messy on purpose, so you
> can see what "enough" looks like going in. Yours does not need to be tidier than this.

---

## The account

Freight and 3PL, ~14,000 employees, 11 subsidiaries under one parent. Been on the same expense
vendor since 2019, auto-renewed every year, procurement owned the relationship and liked it that
way. Cold outbound, May 12. Harder than normal because nobody was shopping — there was no event,
no trigger, no budget line. I was creating the deal, not catching one.

## The pain

2,400 drivers submitting paper receipts. Controller (Priya) told me it took 11 days to close the
books, target was 5. $2.1M in spend sitting unreconciled at any given time. The real one though:
they'd taken a repeat audit finding on expense approvals — same finding two years running. She
gave me both numbers on the second call, unprompted, when I asked what her month-end looked like.

Consequence of doing nothing: the CFO had committed the board to a clean FY26 audit. A third
repeat finding was not survivable for her.

## The people

- **Economic buyer** — Dana Okafor, CFO. Owns the number. Did not care about product at all,
  cared about audit risk. I did not meet her until week 6, which was my mistake.
- **Champion** — Marcus Hale, VP Finance. Built the business case with me, ran the internal
  readout without me in the room. Tested twice.
- **Coach** — Priya Raman, Controller. Fed me the close-process pain week by week.
- **Technical** — Tom Byrne, CISO. Hard no until SOC 2 scope and SSO were proven. Sam Ellis,
  Dir. Enterprise Apps, reports to Tom, owned the NetSuite integration risk.
- **User buyer** — Lena Cruz, VP Field Ops. The 2,400 drivers are hers. Loudest advocate we had.
- **Blocker** — Gil Anders, Dir. Procurement. Incumbent relationship. Ran the process to protect
  it — re-opened the renewal the moment we lost momentum.
- Ava Sterling, Assoc. GC, reports into Gil's org. Showed up late and cost us two weeks.

## Where it went wrong

July 9, it stalled. A reorg moved Marcus off the project and I had no one else senior. Gil used
the gap to re-open the incumbent renewal. Six weeks, no meetings.

What I got wrong: I had a champion and I thought that was qualification. I had never met the
person who owned the money, so when my champion moved, the deal had nothing holding it up.

## The turn

July 28, got to Dana. Went in on the board's audit commitment instead of the product — asked what
a third repeat finding would cost her, not what our approval workflow did. That reframed it from
a software purchase to a remediation, which meant it could be funded out of the audit remediation
budget instead of fighting for a new IT line. Marcus came back to the deal once it was the CFO's.

## The hurdles

- **Security** — Tom blocked pending SOC 2 scope and SCIM. Ran a joint architecture session week 9,
  cleared Sep 2.
- **Integration** — NetSuite, custom GL dimensions, 11 subsidiaries. Too big to prove in one go,
  so we scoped a 3-week pilot on one subsidiary. Started Sep 22.
- **Legal** — Ava wanted a 3x fees liability cap, we cap at 1x. Traded the cap for a shorter cure
  period, which she actually cared more about.
- **Budget** — no line existed. Spend was split across three cost centres. Funded from audit
  remediation.
- **Competition** — the incumbent, and honestly "do nothing" was the real one. Framed against both
  as risk removal, not feature comparison.

## The close

Sequence was security → legal → CFO signature. Legal was the hidden gate, and I only found it
when I mapped the process properly in week 7. Started the DPA in parallel that week instead of
waiting until after security cleared — that's most of where the time saving came from.
Signed Nov 14, inside the quarter.

## The outcome

$1.24M ACV, $3.7M TCV, 36 months. 187 days start to signature, team average is 218.
Broke a six-year renewal cycle. +$410K expansion in month seven when two more subsidiaries came on.

## The lesson

Pain travels upward — the Controller's number was what got the CFO's attention, but I sat on it
for six weeks. Qualify the buyer, not the meeting. Run security and legal in parallel. And a
champion you haven't tested is a coach.

---

## Constraints for this telling

- Slot length: 6 minutes
- Anonymise: yes — names and company changed, all numbers real
- Don't want to be asked about: nothing, the stall is the best part of the story
