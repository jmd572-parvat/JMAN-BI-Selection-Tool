# Platform reach: can every platform show up?

Assessment of 2026-11-18, after a review found that clients who answered many questions kept getting Qlik or Power BI.
Everything below is produced by `python scripts/platform_reach.py` from `data/questions.json`; run it again after any score or weight change.
The fairness check behind it is `python scripts/platform_reach.py --check` and harness checks N3, N3b and N3d (`python scripts/validate_model.py`).

## Findings
1. **The raw sheet does lean to Power BI.** It scores highest or joint highest on 59 of 92 answers and averages 3.33 against Looker's 2.62.
   Ranked by raw sums, Power BI would be first for 86% of simulated clients. The engine never ranks by raw sums (`docs/scoring-method.md`).
2. **The engine had a second, subtler lean, now fixed.** Each tool is compared with a reference score on every question. For the requirement
   questions (polish, AI, cost, users, talent, self-hosting) the reference was the neutral score 2 for every tool. A broadly capable tool scores
   3 or 4 on almost every requirement answer, so it earned a premium **for each requirement the client stated**. The more questions answered,
   the more the broad tools (Power BI, Qlik, Tableau) won, whatever the client actually needed. With all six requirements stated Power BI was first
   for 30% of clients and ThoughtSpot for 4% (mean score +0.96 against -0.09). Earlier documentation called this "not structural"; that was wrong.
3. **The fix** centres each tool on its own average requirement premium, the same idea the engine already used for every other question
   (`requirement_premium` in `scripts/bi_model.py`, mirrored in `scripts/excel_to_json.py` and `src/engine/engine.js`). After it, clients who state
   any number of requirements give every tool between 12% and 19% of first places (ideal 16.7%), and the average score is within 0.02 of zero for every tool.
4. **Every platform can show up.** Each is first for 12 to 18 of the 89 scored single answers, and the deck's own scenario for each platform is
   reproduced (table 4). Winning shares are not identical, because the SME scores are not symmetric, but none is out of the fair band of 10% to 24%.

## What did not change, and one side effect
- The SME scores are untouched. Only the reference each tool is compared with changed.
- A single stated requirement can now separate two tools that the sheet scores identically, by a small amount in favour of the one that is generally
  weaker on requirements (Sigma 0.17 z ahead of Tableau on "presentation-quality dashboards", where both score 4). That is inside "too close to call",
  and the page says so. It is the price of removing the head start that broad tools had.
- Requirement scores for Looker, ThoughtSpot and Sigma on cost, talent pool and scale (Q23, Q24, Q25) are still low. If an SME believes any of
  them is too low, that is a legitimate review item; it is a score question, not a method question.

## Data

## 1. The raw sheet

| | Looker | Power BI | Qlik | Sigma | Tableau | ThoughtSpot |
|---|---|---|---|---|---|---|
| Mean score over all answers | 2.62 | 3.33 | 3.07 | 2.93 | 3.03 | 2.88 |
| Answers where it scores highest or joint highest (of 92) | 33 | 59 | 39 | 43 | 36 | 37 |
| Share of simulated clients it would win if ranked by raw sums | 0% | 86% | 5% | 5% | 5% | 0% |

## 2. Simulated clients: how often each tool is first, and in the top three

Uniform random answers; k = how many of the requirement questions (Q21, Q22, Q23, Q25, Q26, Q24) the client states.

**Before the correction** (first place / top three)

| | Looker | Power BI | Qlik | Sigma | Tableau | ThoughtSpot |
|---|---|---|---|---|---|---|
| k = 0 | 17% / 46% | 20% / 51% | 17% / 51% | 16% / 51% | 19% / 50% | 12% / 52% |
| k = 3 | 12% / 36% | 25% / 66% | 21% / 62% | 16% / 43% | 20% / 57% | 7% / 36% |
| k = 6 | 8% / 27% | 30% / 75% | 25% / 72% | 13% / 34% | 21% / 66% | 4% / 26% |

**After the correction (what ships)** (first place / top three)

| | Looker | Power BI | Qlik | Sigma | Tableau | ThoughtSpot |
|---|---|---|---|---|---|---|
| k = 0 | 17% / 46% | 20% / 51% | 17% / 51% | 16% / 51% | 19% / 50% | 12% / 52% |
| k = 3 | 17% / 49% | 19% / 53% | 17% / 51% | 16% / 45% | 18% / 50% | 13% / 52% |
| k = 6 | 18% / 50% | 18% / 53% | 17% / 55% | 14% / 37% | 18% / 52% | 15% / 54% |

## 3. How many single answers put each tool first

| | Looker | Power BI | Qlik | Sigma | Tableau | ThoughtSpot |
|---|---|---|---|---|---|---|
| Answers (of 89) that put it first alone, ties shared | 15.0 | 17.7 | 12.7 | 17.0 | 13.3 | 13.3 |

## 4. One deck scenario per platform

| Client (deck slide 20) | Answers pinned | Result |
|---|---|---|
| Deep in Microsoft 365/Azure, wants fast adoption | 2 | Power BI first, Power BI first (+1.01 z) |
| Google Cloud-native, wants governed self-service | 2 | Looker first, Looker first (+0.82 z) |
| Salesforce-centric (decision tree step 3) | 1 | Tableau first, Tableau first (+2.25 z) |
| Needs highly custom, presentation-quality dashboards | 1 | Sigma first, Tableau rank 2 (+0.17 z) |
| Business users want to just ask questions in plain English | 3 | ThoughtSpot first, ThoughtSpot first (+1.83 z) |
| Regulated or hybrid, needs on-prem control | 4 | Qlik first, Qlik first (+0.88 z) |
| Spreadsheet-heavy finance team, limited IT support | 3 | Sigma first, Sigma first (+1.26 z) |
