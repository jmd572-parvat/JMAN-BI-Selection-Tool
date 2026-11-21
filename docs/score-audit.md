# Score audit (2026-11-20)

Owner concern: serious doubts about the marks (the 1 to 4 scores) behind the recommendation. This audit checked all 110 answers (95 that carry scores) across 26 questions, six tools each, 660 scores, plus the weights.

**When this audit was written no score or weight had been changed. On 2026-11-21 the owner asked for a review by judgement and several were changed (see section 21 of `page-design.md`): H1, H2 (in part), H3, M1, M2, M4 and M5 below, and the duplicated on-premises answers in M6. H4 was tried and taken back.** The scores belong to the owner and the subject-matter experts, and the workbook is edited only through Excel. This document lists what is doubtful, with evidence, and what each fix would change. The numbers come from `scripts/validate_model.py` and a one-off analysis on the Python engine (3,000 random clients, seed 7; the script is not kept in the repo).

## Findings that most deserve a decision

| # | What is doubtful | Evidence | If corrected |
|---|---|---|---|
| H1 | **Sigma scores level with Tableau on visual polish** (Q21: critical 4, important 3; Tableau 4, 3). | The score comes from the deck heatmap (Sigma 5). The answer's own note says Sigma's 4 "reflects easiest to self-edit, not bespoke presentation quality". The deck's own scenario for "highly custom, presentation-quality dashboards" names Tableau, yet today Sigma comes out ahead of Tableau (+2.39 against +2.22, scenario S3b). | Sigma 3 and 2: Tableau leads that scenario (+2.22 against +1.56); the #1 changes for 1.4% of random clients. |
| H2 | **The forecasting answer scores planning, not forecasting** (Q01 "Improved forecasting and planning"). Tableau 1 and Sigma 4. | The deck rates Tableau strong on forecasting (heatmap 3.2) and says Sigma has "no native forecasting". The score follows write-back and planning (Input Tables), which is a different need under the same label. Known since the earlier validation (F5), not fixed. | Tableau 3, Sigma 2: the #1 changes for 4.9% of clients. Better: split the answer into *forecasting* and *planning / write-back*. |
| H3 | **Power BI scores 4 for on-premises** (Q16 hybrid, Q18 offline, Q26 no self-hosted). | Microsoft says Report Server is intentionally simple and many service features are service-only. The earlier validation (F5) recommended 3; not applied. | Power BI 3: the #1 changes for 5.3% of clients. |
| H4 | **Ease of adoption contradicts the deck.** Q11 "Beginner" and Q12 "No training required": Power BI 3, Tableau 4. | The deck marks Power BI, ThoughtSpot and Sigma as leading ease of adoption, and Tableau only as "quick to learn". | Power BI 4, Tableau 3: the #1 changes for 6.1% of clients. |
| H5 | **The weights were never elicited.** Q04 carries 5 points, Q16 and Q20 carry 4. | The weighting workshop kit exists but the session has not been held. Moving every weight by 1 changes the top three for 29% of clients and the #1 for 20% (`validate_model.py` section 8). | A documented session with three or more people. |

Correcting H1 to H4 together changes the #1 for 12.1% of random clients. No tool's share of wins moves by more than 1.2 points, so the fixes are about being right for individual clients, not about tilting the field.

## Medium

- **M1 Pixel-perfect output (Q19, weight 3).** Sigma scores 2 ("may need a separate reporting tool"). Sigma's own changelog says pixel-perfect reports reached general availability on 13 March 2026, with scheduled PDF and PowerPoint export and bursting (vendor source; no independent review found). Tableau scores 4, equal to Power BI, but no source found supports it and its own note says "verify". Power BI's paginated reports are well documented by Microsoft.
- **M2 Parallel run (Q20, weight 4).** Looker and ThoughtSpot score 2, the other four 4, but the notes describe the same action for every tool ("run alongside the incumbent and compare"). A 2-point gap on a weight-4 question (about 0.5 z per point) has no stated basis.
- **M3 Migration scale (Q15).** Looker rises with scale (2, 3, 4) on an economies-of-scale argument; Power BI falls (4, 4, 3); Tableau stays at 3. Plausible but speculative.
- **M4 AI scores are older than the products.** They come from the deck heatmap. Sigma Assistant (May 2026) unifies Ask Sigma and AI Builder, yet Sigma scores 2 ("lighter AI"); Looker scores 2 although Gemini and Conversational Analytics are documented by Google.
- **M5 Cost (Q23).** ThoughtSpot scores 1 and Tableau 2, but ThoughtSpot's page shows Essentials from $25 per user per month. The deck heatmap is not a list-price comparison. Looker scores 1 against the heatmap's 2 (documented as an SME choice). List price is not total cost of ownership either.
- **M6 One fact counted several times.** Being on-premises is scored in Q16 (weight 4), Q18 (3) and Q26 (3) with identical score vectors: 10 of the 46 always-asked weight points (22%). The live-warehouse signal has one vector in Q01, Q15, Q16 and Q18. Exit-readiness and private-equity-exit (Q01, Q02) are identical; so are Q05 "Yes" and Q09 "Yes", and Q10 "Client team" and "Joint delivery".

## Low

- The 1 to 4 scale merges the heatmap's 1 and 2 into 1, so a tool that is weak and one that is poor look the same.
- A prerequisite such as "no warehouse" can only score 1, so a blocked tool can still rank high through other answers.
- Power BI has 53% of its scores at 4 and almost none at 1; Looker has 19% at 1. The ranking removes each tool's own average, so a 3 for Power BI counts against it and a 3 for Looker counts for it. The word shown beside an answer (Strong, Good…) is the absolute fit and is not what moves the rank; the page says so.

## What holds up

- The five questions derived from the heatmap (Q21 to Q25) apply the stated rule exactly, with one documented exception (Looker on a tight budget).
- Q14 ("tools in use") matches the deck's migration grid with no mismatches.
- Every ordinal ladder (semantic layer, governance maturity, AI concern, skill, migration scale, talent) is monotone for every tool.
- Fairness tests pass: with no stated requirement each tool's average is within 0.013 z of the others, and each tool wins 12.7% to 18.9% of random clients.
- Each of the six tools wins one of the deck's scenarios (S3b is a warning).
- The only automatic rule-out, Sigma when a vendor-hosted tool is not acceptable, matches Sigma's documentation.

## What I recommend, in order

1. A short review with the experts on H1 to H4, M1 and M2 (a table of current and proposed scores, with the reasons above). I can apply approved changes through Excel, regenerate the parity fixtures and rerun the whole suite.
2. Split the forecasting answer in two (H2) rather than editing its scores.
3. Hold the weighting session (H5), then recalibrate the confidence thresholds.
4. Record where every score came from (deck row, vendor page, expert name and date). Today every answer has a per-tool explanation, but only 23 of 110 record a source or a review status.
5. Re-check the vendor-dependent scores (AI, pixel-perfect, cost, hosting) each quarter.
