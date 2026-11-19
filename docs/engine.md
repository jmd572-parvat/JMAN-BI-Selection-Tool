# JavaScript engine

Dependency-free, no build step. Two files in `src/engine/`:

| File | What it is |
|---|---|
| `engine.js` | Scoring: branching, standardised ranking, filters, ties, Pareto guard. A line-for-line match of `scripts/bi_model.py`. |
| `session.js` | What the page needs: validated answers, branch pruning, progress, a ready-to-render `result()`, `explain(tool)`, save/restore. |

Both are UMD: `require('./src/engine/session.js')` in Node, or plain script tags in the browser (global `BIEngine`, then `BISession`).

```html
<script src="engine.js"></script>
<script src="session.js"></script>
<script>
  fetch('questions.json').then(r => r.json()).then(model => {
    const s = new BISession.Session(model);
    s.visible();                                  // the questions to render now, in asking order
    s.answer('Q04', ['microsoft']);               // validates; returns { pruned: [...] } if a branch closed
    const result = s.result();                    // see below
    const why = s.explain(result.ranking[0].tool.id);
  });
</script>
```

## Other session methods
| Method | Meaning |
|---|---|
| `progress()` | `{visible, answered, remaining, weightVisible, weightAnswered, coverage}`. `coverage` is the share of the visible question *weight* that has an answer (any answer, including "not sure yet"), 0 to 1. Weights are provisional and never shown to the client. |
| `openQuestions()` | Unanswered visible questions, heaviest first, then in asking order: `{id, text, section, order}`. Feeds "Matters most, still open". |

## `result()`
| Field | Meaning |
|---|---|
| `state` | `none` (nothing scored), `provisional`, `near` (coverage at or above `NEAR_COMPLETE_COVERAGE`) or `complete` (every visible question answered). The page hedges its wording while the state is `provisional`. |
| `coverage` | The same figure as `progress().coverage`. |
| `informative` | False until at least one scored answer exists. Show "answer questions to see a ranking" instead of a list. |
| `ranking[]` | `{tool, rank, z, absoluteFit, tied, tiedWith}` in rank order; equal ranks alphabetical. Rank by this, never by data order. |
| `shortlist[]` | Everything with rank 3 or better (more than three when ties span the cut). |
| `margin`, `leadStrength`, `tooCloseToCall` | Lead of #1 over #2 in z. `leadStrength` is `clear` (0.5 z or more), `narrow` (0.3 up to 0.5), `tooClose` (below 0.3, or any tie) or `none`. `tooCloseToCall` is true for `tooClose`. The two constants are `TOO_CLOSE_Z` and `CLEAR_LEAD_Z`; they were derived from data by `scripts/calibrate_thresholds.py` and must be re-derived after the weights change. |
| `shortlistBoundary` | `{gap, strength, firstLeftOut}`: how far the last shortlisted tool is ahead of the first one left out, classified with the same bands. `null` when nothing is left out. The top-three set is only stable when this is clear. |
| `coLeaders[]` | Tools tied for first. Show them side by side; do not pick one. |
| `adjustedByDominance[]` | Tools ranked below one that fits at least as well on every answer, although their z is higher. Explain it in the UI. |
| `excluded[]` | Tools removed by a mandatory filter, with the question and answer that removed them. |
| `countedQuestions`, `visibleQuestions` | How many answers actually shaped the result. Show it: z is relative to a no-information client. |
| `usesDraftQuestions[]` | Draft questions that influenced the result (none at the moment, since the owner approved all six). Show a banner while any are in use. |
| `raw` | The engine output (z, rank, per-question contributions) for anything custom. |

`explain(toolId, n)` returns `strengths` and `concerns`: the questions that moved that tool most, each with the client's answer and the SME's
per-tool rationale for it.

## Rules the page must follow
These come from [scoring-method.md](scoring-method.md); the engine already obeys them, the page must not undo them.
1. List tools by `ranking` order. Never sort by sheet order, deck order or "popularity".
2. Show tied leaders as co-leaders.
3. Show the margin and say "too close to call" when `tooCloseToCall`.
4. Show `absoluteFit` only as supporting evidence, never as the rank.
5. Tell the client which tools were excluded and why.

## Data contract
The engine reads `data/questions.json`, produced by `python scripts/excel_to_json.py`. It uses the `baseline` and `variance` the converter wrote, plus
`meta.tieBreak`. `engine.verifyCalibration()` reports any drift between those numbers and the scores. Production build: `--exclude-draft`
(see the caveat in `docs/proposed-score-changes.md`).

## Tests
```
npm test                 # 83 tests: parity with Python, bias properties, session behaviour, browser-global loading, page logic, the page module, both site builds
npm run parity:update    # after ANY change to the workbook, bi_model.py or the converter
python scripts/validate_model.py   # model-level checks (neutrality N1-N8, scenarios, branching)
python scripts/calibrate_thresholds.py   # re-derive the lead and coverage thresholds (after any weight change)
python scripts/check_docs.py             # keep docs/page-design.md and the other docs tied to the data and code
```
- **Parity:** `tests/parity.test.js` replays 200 recorded cases (scenarios, edge cases, weight overrides, raw mode, random clients) against the Python
  reference. It refuses to run against a stale fixture (SHA of `questions.json`).
- **Bias properties:** equal expected score and volatility, fair share of wins, tool order irrelevant, ties shared, Pareto guard exercised.
- The tests were checked by deliberately breaking the engine five ways (wrong z, no Pareto guard, raw scores, positional ties, ignoring closed branches);
  each break was caught.

## Not in the engine
- The decision-tree cross-check from deck slide 19 as a computed result: the page shows the deck's fast path as reference content next to the weighted result, but nothing is computed from it.
- The migration-adjusted score for clients with an existing BI tool (deck slide 3, second stage): the page shows the deck's migration feasibility and effort as reference content, unadjusted.

The page that uses the engine is described in `docs/page-design.md`, section 14. `NEAR_COMPLETE_COVERAGE` is one of three calibrated constants with `TOO_CLOSE_Z` and `CLEAR_LEAD_Z`; re-derive all three with `scripts/calibrate_thresholds.py` after the weights change.
