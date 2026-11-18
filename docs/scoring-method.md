# Scoring method: how the tool stays free of platform bias

Requirement: the recommendation must come **only from the client's answers**. No platform may lean ahead because of how the sheet was scored,
the order tools are listed, or how ties are broken. Reference implementation: `scripts/bi_model.py`. The JavaScript engine must match it.

## The problem with adding up the sheet's scores
The sheet holds the SME's absolute fit (1-4). Summing them looks neutral but is not. Over all answers Power BI averages 3.34 and Looker 2.61.
A client who tells us nothing useful would still see Power BI first about 79% of the time. A tool with *more extreme* scores also wins more often
by chance (plain centering made Looker win 25%). So the engine does not rank by the raw sum.

## What it does instead
For every question, each tool has a **reference score**: what that tool scores for a client who gives no information on this question.

| Question kind | Reference | Why |
|---|---|---|
| Categorical (ecosystem, skills, scale, governance maturity ...). Column `Reference = mean` | The tool's own average over the question's informative answers | No answer means "no information", so a tool's average is the only fair baseline. Removes a tool's general strength. |
| Requirement (cost, visuals, AI, talent, users, self-hosting). Column `Reference = neutral` | The score 2, the "not a priority" answer, plus the tool's own average requirement premium (below) | A stated requirement lifts the tools that meet it more than they usually meet requirements. An absent one changes nothing. |

**The requirement premium.** A broadly capable tool scores 3 or 4 on nearly every requirement answer. Measured against the score 2 alone, it
earned that premium on every requirement a client stated, so the more questions were answered the more Power BI, Qlik and Tableau won,
whatever the client needed (with all six requirements stated: Power BI first for 30% of simulated clients, ThoughtSpot for 4%). So each tool's
reference on a requirement question is 2 plus that tool's own average premium over the weighted requirement questions
(`requirement_premium` in `scripts/bi_model.py`; it is stored in `data/questions.json` as `meta.requirementPremium`). This is the same idea as centring on
the tool's own mean for every other question. Full evidence: `docs/platform-reach.md`. The premium depends on the question weights, so
re-run `python scripts/excel_to_json.py` after the weighting session.

For a client's answers (multi-select = average of the selected answers' scores, `r`):

```
F[tool] = sum over answered questions of  weight * (r - reference)       advantage over a client with no information
S[tool] = sqrt( sum of weight^2 * variance )                            how much that tool's score can swing
z[tool] = F / S                                                         the ranking score
```

`z` reads as "how many standard deviations better than a no-information client". Dividing by `S` stops a tool with extreme scores
winning more often just because it swings more.

## Tested properties (harness section 6)
| | Property | Result |
|---|---|---|
| N1 | Client states no requirement: every tool has the same expected score | max abs mean z 0.023 (limit 0.05) |
| N2 | Equal volatility across tools | stdev ratio 1.12 (limit 1.25) |
| N3 | Every tool wins a fair share of such clients (ideal 16.7%) | 12.7% to 18.9% (band 10-24%) |
| N3b | Same, for fully random clients who also state requirements | 12.8% to 18.9% (band 10-24%; before the premium correction 4% to 33%) |
| N3d | Stating requirements gives no tool a head start: mean z of fully random clients | max abs 0.019 (limit 0.05; before the correction Power BI averaged +0.96) |
| N4 | Tool order never changes any rank | pass |
| N5 | No tool outranks one that is at least as good on every answered question | pass |
| N6 | Identical totals share a rank | pass |
| N7 | `baseline` and `variance` in the JSON match the scores | pass |
| N8 | Tools carry no display order; alphabetical | pass |

Reach: every tool is first for between 12 and 18 of the 89 scored single answers, and the deck's scenario for each platform is reproduced. See `docs/platform-reach.md`.

One side effect of the premium correction: a single stated requirement can separate two tools that the sheet scores identically, by a small amount in
favour of the one that is generally weaker on requirements (about 0.2 z, inside "too close to call"). The page says "too close to call" in that case.

## Rules that keep it fair
- **Hidden questions** (branching) and **Unknown answers** count in neither `F` nor `S`.
- **Excludes** (mandatory filters, e.g. Sigma is cloud SaaS only) remove tools before ranking; they are listed as excluded with the reason.
- **Pareto guard:** if tool B is at least as good as tool A on every answered question and better on one, A can never outrank B.
  Standardising can otherwise invert this in rare cases. The UI should explain it: "ranked above because it fits at least as well on every answer you gave".
- **Ties:** broken only by the client's answers, in the Flow sheet's order: ecosystem fit (Q04), governance and security fit (Q05-Q09, Q26),
  then delivery risk and cost (Q10-Q12, Q20, Q23). If still tied, tools **share a rank**. Nothing else breaks a tie, never list position.
- **Weights** apply to questions, never to tools.

## UI contract (for the playbook page)
1. Order tools by rank, then **alphabetically** for equal ranks. Never use the sheet's or the deck's order.
2. Show the lead strength (`leadStrength`): clear at 0.5 z or more, narrow from 0.3, otherwise "too close to call". These bands come from data: with the provisional weights the leader stays first under +-1 weight noise 98% of the time when clear, 87% when narrow and 64% below 0.3 (`scripts/calibrate_thresholds.py`; re-run after the weights change). The top-three set needs its own check, `shortlistBoundary`: it stays the same 97% of the time when the gap between 3rd and 4th is 0.5 z or more, 83% from 0.3, and only 57% below 0.3.
3. Show tied leaders as co-leaders. Do not pick one.
4. Show `raw_fit` (the old absolute fit) only as supporting evidence, labelled "absolute fit", never as the rank.
5. Explain each of the top three with the per-tool rationales of the answers that moved it most.
6. Hard filters first: show excluded tools with the answer that excluded them.

## Known properties to keep in mind
- Ranking is **relative to a no-information client**, so for a very small answer set (a few questions) differences can be large in z. Show how many questions counted.
- A question with a single informative answer would cancel out under `mean`. The converter refuses that (inert weight); use `neutral`, or weight 0 for filter-only questions.
- Changing which answers a question offers changes its reference. Re-run `excel_to_json.py` after any score or option change; the harness (N7) catches a stale JSON.
