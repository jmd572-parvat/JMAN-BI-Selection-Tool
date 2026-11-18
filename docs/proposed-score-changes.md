# Proposed score changes and draft-question review

Status 2026-11-17. **Nothing here is applied** except where stated: these are SME-scored cells, so the changes need sign-off.
Re-run any change with `python scripts/excel_to_json.py && python scripts/validate_model.py`.

## 1. What changed in workbook v2 (already applied)
- New columns: `Order`, `Status`, `Score basis`, `Combined (legacy)`.
- Six **draft** questions (Q21-Q26), scored from the deck heatmap with one stated rule, each option citing its basis.
- Q20 'Tight budget' moved to Q23 and Q20 'On-premises / residency constraint' moved to Q26. Scores and per-tool rationales are unchanged;
  this removes a double count. Q26 'No' carries `Excludes = sigma` (Sigma is cloud SaaS only).
- `Combined Final Rationale` regenerated for every option from its scores and per-tool rationales (tier words, all six tools, no numbers).
  The SME's original text is preserved in `Combined (legacy)`.
- Verified: all 89 original options keep identical scores and per-tool rationales.

Harness after v2: 26 pass, 7 warn, 2 fail (was 18 / 9 / 3). After the bias-free engine (v3): **37 pass, 6 warn, 0 fail**. Stale rationale numbers: 51 -> 0.

## 2. Draft questions to review (weights provisional)
| Q | Question | Weight | Score source |
|---|---|---|---|
| Q21 | Presentation-quality dashboards and storytelling | 2 | Heatmap row 'Visualization & Storytelling' |
| Q22 | AI-assisted / natural-language analytics a priority | 2 | Heatmap row 'AI-Assisted & Conversational' |
| Q23 | How much licensing cost drives the decision | 3 | 'Tight budget' moved unchanged from Q20; 'Balanced' from heatmap 'Licensing & TCO' |
| Q24 | Talent pool and partner ecosystem | 1 | Heatmap row 'Community & Partner Support' |
| Q25 | Number of users | 1 | Heatmap row 'Scalability & Performance' (small user bases are neutral on purpose) |
| Q26 | Is a vendor-hosted SaaS platform acceptable | 3 | 'No' moved unchanged from Q20; `Excludes = sigma` |

Rule used for every derived score: heatmap 1-5 to sheet 1-4 as 5->4, 4->3, 3->2, 2->1, 1->1; 'Important' / 'Balanced' variants compress the top
(4->3); neutral answers score 2 for every tool and are flagged Unknown. This is the same mapping the existing 'Tight budget' row follows.

Review points:
- **Q21 critical: Sigma 4.** The heatmap gives Sigma 5 for 'Visualization & Storytelling' because it is easiest to self-edit,
  not because it produces bespoke presentation-quality visuals. Likely too high for this question.
- **Q23 tight budget: Looker 1** versus heatmap 2.5. Original SME score kept.
- **Q25** deliberately ignores cost at small sizes, because Q23 already captures it.
- The draft questions carry the heatmap's Power BI lead on cost, talent and AI. Under the bias-free engine this no longer tilts clients who state no requirement; it only
  shows when a client states such a requirement (Power BI's expected advantage over fully random clients is +8.0 points, mostly cost +3.0, AI +2.0, self-hosting +2.0). The team should confirm those ratings.
- Build the production JSON with `python scripts/excel_to_json.py --exclude-draft` until these are approved.
  **Caveat:** that build has 87 options, not 89, because the two SME-scored options moved out of Q20 now sit inside draft questions
  (Q23 'Tight budget', Q26 'No'). It therefore loses the budget and self-hosted signals. To ship before review, either approve Q23 and Q26
  (their moved options are already SME-scored; only 'Balanced' and the neutral answers are derived) or move those two options back to Q20.

## 3. Proposed score changes (not applied) with test results
Re-tested on 2026-11-17 under the final bias-free engine ([scoring-method.md](scoring-method.md)). Results are profile-only scenario runs on fixtures that pin only
what the deck sentence says; margin is the winner's lead over #2 in z. Each change is justified independently (documentation or the deck's own heatmap),
**not** chosen to make scenarios pass.

| # | Change | Evidence | Effect under the bias-free engine |
|---|---|---|---|
| P1 | Power BI 4 -> 3 on the three on-prem options (Q16 `hybrid_on_premises`, Q18 `offline_on_premises_operation`, Q26 `no_self_hosted`) | Microsoft describes Report Server's feature set as [intentionally simple](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-usage-scenario-on-premises-reporting) and many service features as [service-only](https://learn.microsoft.com/en-gb/power-BI/report-server/compare-report-server-service). A review comment asked for 5; the evidence points the other way. | S5 (regulated/hybrid) already passes; margin 0.70 -> 0.82 |
| P2 | Power BI and Qlik 4 -> 3 on Q17 `custom_visuals_extensions` | Deck heatmap 'Visualization & Storytelling': Power BI 3, Qlik 3 (Tableau 5); the sheet scores both 4. | No scenario changes; a consistency fix against the deck |
| P3 | Neutralise Q18 `offline_on_premises_operation` | Q16 `hybrid_on_premises`, Q18 and Q26 `no_self_hosted` carry one identical vector, so one on-prem fact is counted three times. | Removes the triple count; not scenario-tested |
| P4 | Differentiate Q05 'Yes' and Q09 'Yes' | Identical vectors today (correlation 1.00); strict compliance and AI-governance concern are different facts. Deck: ThoughtSpot's governed semantic layer, Looker's LookML-grounded Gemini. | Needs SME scores |
| P5 | Review Sigma on Q06 `enterprise_security` (2) | Deck slide 7 says Sigma has the 'simplest security model' (heatmap 5); rationale says granular protection depends on the data platform. | Needs SME scores |
| P6 | Sigma 4 -> 3 on Q21 `critical` (and `important` stays 3) | The heatmap's Sigma 5 reflects 'easiest to self-edit', not bespoke presentation quality (flagged in the score basis before testing). | S3b (custom dashboards) flips from an exact Tableau/Sigma tie to **Tableau**, margin 0.33 |
| P7 | Review Q23 'Balanced' | Under the compress rule it still gives Power BI +1 and ThoughtSpot -1, although 'balanced' should be close to neutral. | Needs SME decision |

Neutrality is unchanged by every change above (max abs mean z 0.023, volatility ratio 1.12 to 1.13, every tool wins about 12% to 19% of clients who state no requirement).
Under the earlier raw-sum engine, P1 and P2 were needed to pass S5 and S3b; the bias-free engine removes that dependence.

## 4. Still open (need a person)
- **Q12 near-duplicate:** 'Can upskill' sits beside the Flow's 'Limited upskilling capacity'. Merge or delete one.
- **Three options without scores** (skipped by the converter): Q06 'Data residency requirement', Q12 'Limited upskilling capacity', Q12 'No capacity for change'.
- **Looker and ThoughtSpot almost never rank first** for random clients (Looker 0.0%, ThoughtSpot under 1%; both still win their own deck scenarios).
  Looker carries 17 of the sheet's scores of 1. Decide whether those are soft penalties or should be shown as "needs a prerequisite" in the UI.
- **Review comments:** K17 ("rationale is not sufficient") is superseded by the regenerated combined rationales. F40 (Looker scoring low where the
  factor is not a priority, e.g. 'Basic' security) is a policy question: scores here express *fit including setup overhead*, so Looker's LookML overhead is
  penalised even when requirements are simple. Decide whether to keep that or score simple requirements neutrally.
- **Deck:** slide 22 on-prem claims, the Tableau slide's copy-pasted Power BI features, slide 25's Gartner wording.
- **Weights:** run the workshop (`docs/weighting-workshop.md`).
