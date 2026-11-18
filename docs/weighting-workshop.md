# Weighting workshop: facilitation guide

Purpose: replace the provisional question weights (0-5) with weights the team can defend.
Why it matters: nudging every weight by +-1 changes the top-3 shortlist for about 25% of clients and the #1 pick for about 16%
(`python scripts/validate_model.py`, section 8). The ranking is bias-free ([scoring-method.md](scoring-method.md)), so nothing masks the weights any more:
they are consequential and need a recorded basis. Weights apply to questions, never to tools.

Method: **swing weighting** with independent first-round ratings and a median aggregate
([swing weights](https://dlab.sauder.ubc.ca/sjdm/journal/8430/jdm8430.html);
[why correlated criteria need care](https://knowledge4policy.ec.europa.eu/composite-indicators/10-step-guide/step-6-weighting_en)).

## Who
3 to 5 people with different views of a client engagement: at least one each from delivery, pre-sales/sales, and data architecture.
Add a client-facing partner if possible. Name a facilitator who does **not** rate, and a scribe.

## Before the session (facilitator, 15 minutes)
1. `python scripts/excel_to_json.py` then `python scripts/validate_model.py`; confirm the harness runs.
2. `python scripts/weights_workshop.py init` creates `data/weighting/ratings-template.csv` (25 questions; Q13 is a gate and is not rated).
3. Copy the template once per participant into `data/weighting/ratings/<name>.csv`.
4. Do **not** share the current weights, the Monte Carlo results or the scenario results. Anchoring on them defeats the exercise.

## The question participants answer
> Take two otherwise identical clients. Client A gives the **most demanding** answer to this question
> (for example: on-premises required, or board-grade visuals are critical). Client B gives the **least demanding** answer.
> How big a difference does that make to *which BI platform is the right one*, compared with the other questions?

Rate the question whose swing matters most as **100**. Rate every other question 0-100 relative to it. 0 means "does not matter for tool choice".
Rate importance to the *decision*, not how much the tools differ in a spreadsheet: the sheet's scores already carry that.

## Agenda (about 90 minutes)
| Min | Step | Rule |
|---|---|---|
| 10 | Context | Walk through the deck's flow (slide 3) and the 6 tools. No weights shown. |
| 10 | Define the swing | Read the question above aloud. Run one practice question together (use Q04 ecosystem). |
| 15 | **Round 1: rate alone, silently** | Each person fills their own CSV. No talking. |
| 5 | Collect | `python scripts/weights_workshop.py aggregate`. Check the WARN lines: fix blanks, make sure everyone anchored one question at 100. |
| 30 | **Discuss only the DISCUSS rows** | Rows where the group has not converged (IQR above 25 or range above 50). Ask the highest and lowest rater to explain; look for a missing scenario, not a winner. |
| 10 | **Round 2**: re-rate DISCUSS rows only | Same rules. Others stay as they are. |
| 10 | Review impact | Read the theme-concentration and scenario preview from the aggregate output. |

## Decision rules
- Group value is the **median** of participants; weight = `round(median / 20)`, clamped 0-5.
- Theme concentration limit is 25% of total weight. If a theme is over, discuss *double counting* before touching ratings
  (for example two governance questions that signal the same thing).
- If a rater thinks a question measures something already covered elsewhere, record it; the fix is usually merging or neutralising an option, not lowering a weight.
- Record dissent: who disagreed, on which questions, and why. It goes in the sign-off table below.

## Do not
- Do not adjust ratings so that a deck scenario passes. Scenarios are tests of the model, not targets for the weights.
- Do not rate the six draft questions (Q21-Q26) as if their scores were final; rate how much the *topic* should matter.
  Their scores are separately reviewed (`docs/proposed-score-changes.md`).
- Do not average in people who did not take part in round 1.

## After the session
1. Enter the agreed weights in `data/bi-tools-questions.xlsx` (column F), by hand, after sign-off.
2. `python scripts/excel_to_json.py && python scripts/validate_model.py`; attach the output to the sign-off record.
3. Commit the ratings CSVs (names optional), `weights-proposal.csv` and this record.
4. Review again at least every six months, and whenever a tool's pricing, editions or AI features change materially.

## Sign-off record (copy into the commit message or the playbook page)
| Field | Value |
|---|---|
| Date | |
| Participants and roles | |
| Facilitator / scribe | |
| Questions that needed round 2 | |
| Recorded dissent | |
| Harness result after the change | pass / warn / fail counts |
| Weights version | v1 |
| Next review date | |
