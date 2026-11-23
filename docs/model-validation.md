# BI selection model: validation report

Date: 2026-11-17. Model under test: `data/bi-tools-questions.xlsx` (20 questions, 89 scored options, starter weights).
Reproduce everything: `python scripts/excel_to_json.py && python scripts/validate_model.py` (deterministic; fixed seeds).
Reference engine: `scripts/bi_model.py` (executable spec of the Flow sheet's recommendation method).

## Verdict

**Original verdict (2026-11-17, before any fix; the status sections below give the current state: 37 pass / 6 warn / 0 fail): not ready to ship.** The mechanics are sound (engine tests pass; migration scores match the deck exactly), but the model
does not yet reproduce the deck's own recommendation patterns, one branching rule is wrong, and the weights are unjustified.
At that point the harness reported **12 pass, 9 warn, 8 fail**.

| Area | Result | One-line reason |
|---|---|---|
| Engine mechanics | PASS | stale answers, multi-select averaging, unknown handling, empty input all correct |
| Migration scores (Q14) vs deck slide 28 | PASS | 0 of 42 mismatches |
| On-prem scores vs deck slide 22 | PASS | but slide 22 itself is inaccurate (see F5) |
| **Branching** | **FAIL** | gating Q16-Q20 on Q13 hides 39% of the weight from clients with no BI today |
| **Scenario regression (deck slides 19/20)** | **FAIL** | 2 of 8 fail, 1 is an exact tie |
| **Tool bias** | WARN | Power BI wins 78% of random clients; mean score 3.39 vs Looker 2.65 |
| **Weights** | WARN | +-1 noise changes the top-3 for 19% of clients; governance carries 30% of weight with duplicate signals |
| **Coverage** | FAIL | 5 criteria the deck asks about have no question |
| **Rationale text** | FAIL | 51 quoted score numbers are stale (old 1-5 scale), in 26 options |

## Status: fixes applied 2026-11-17 (F1 and part of F4)

Applied with `scripts/_apply_fixes_v1.py` to `data/bi-tools-questions.xlsx`; JSON regenerated. No option score was touched.
- **Branching (F1):** Q16-Q20 are no longer gated on Q13 and their Stage is now `discovery`. Only Q14, Q15 depend on Q13.
- **Governance de-duplication (F4, weights only):** Q05 4->3, Q06 4->3, Q07 3->2, Q08 3->2, Q09 2->1 (Q03 stays 1). Total weight 56 -> 51;
  governance share 30% -> 24%.

Harness: **12 pass / 9 warn / 8 fail -> 18 pass / 9 warn / 3 fail.**

| Check | Before | After |
|---|---|---|
| Worst-path weight kept | 52% | 80% |
| Deployment, budget, performance topics reachable on every path | fail | pass |
| Governance theme share | 30% | 24% |
| Top-3 shortlist flips under +-1 weight noise | 19% | 17% |
| S5g (regulated, no BI today) margin for Qlik | 7.8 pts | 5.2 pts |

Side effect to watch: shrinking total weight raised the technical-requirements share to 25.5%, which now trips the 25% theme warning.
Q5 and Q9 still have identical score vectors; only their weights changed. Differentiating them needs SME scores.

Still failing (all need SME input, not mechanics): S3b (missing visualization-need question), S5 (Power BI on-prem scored 4), and the stale numbers in 26 rationales.
Still tied: S4 (missing natural-language question).

## Status v3 (2026-11-17): bias-free ranking

Requirement from the product owner: the result must come only from the questions, with no lean toward any platform.
Harness: 26 / 7 / 2 -> **37 pass / 6 warn / 0 fail**. Full description: [scoring-method.md](scoring-method.md).
- **Finding F2 fixed at its source.** Ranking by the raw sum of the sheet's scores gave Power BI first for about 79% of clients who state no requirement.
  The engine now standardises each tool against a per-question reference (z-score), and the harness tests neutrality (N1-N8) on every run.
  For clients who state no requirement: max abs mean z 0.023, volatility ratio 1.12, every tool wins 12.7% to 18.9% (ideal 16.7%).
- **Two fixes the first attempt needed.** Plain per-question centering made Looker win 25% (its scores swing most), so volatility is equalised too.
  It also nullified any question with a single informative answer (Q26 contributed nothing), so requirement-style questions now use the
  neutral score 2 as their reference (`Reference` column). The converter refuses inert weights.
- **Bugs found and fixed on the way:** the old engine broke exact ties in sheet order (Power BI first); the first Pareto guard only compared neighbours (83 violations in 6,000 clients).
  Ties now share a rank; tool order provably never matters (N4).
- **Scenarios re-based.** Fixtures now pin only what each deck sentence says (earlier ones added arbitrary extras such as "migrating from Excel", which favour particular tools).
  Result: 6 of 7 pass; **S5 (regulated/hybrid) now passes without changing any SME score**, so the earlier failure was baseline lean. S3b is an exact tie between Tableau and Sigma,
  which is the draft Q21 score for Sigma (4) and needs SME review.
- **Trade-offs to be aware of.** (1) Weights now matter more: +-1 noise changes the top-3 for 25% of random clients (was 15%) and the #1 for 16% (was 9%), because a built-in lead no longer masks them.
  (2) The ranking differs from the raw sum for most random clients; that is the point, but the UI must show the margin and "too close to call".
  (3) Differences that remain when a client states requirements come from the SME and deck scores for those requirements (Power BI +8.0 expected points, mostly cost, AI and self-hosting) and are for the SMEs to confirm.
  (4) Q23 'Balanced' still gives Power BI +1 and ThoughtSpot -1; arguably 'balanced' should be near neutral.

## Status v2 (2026-11-17): new questions, rationale rebuild, workshop kit

Harness: 18 pass / 9 warn / 3 fail -> **26 pass / 7 warn / 2 fail**. Details: [proposed-score-changes.md](proposed-score-changes.md).
- **F3 coverage:** six draft questions added (visual need, AI/natural-language appetite, cost driver, talent pool, user count, vendor-hosted SaaS acceptable).
  Scenario S4 (plain-English) went from an exact tie to a win by 3.6 points. They are drafts: scores derived from the deck heatmap with a stated rule, awaiting SME review.
- **F4 double counting:** Q20's budget and on-prem options moved to Q23 / Q26 (one fact, one place); Q26 adds `Excludes = sigma`.
- **F6 rationale hygiene:** stale numbers 51 -> 0; every differentiating option now names all six tools. Combined rationales are generated; the SME text is kept in a legacy column.
- **F4 weights:** workshop guide, template and aggregator are ready ([weighting-workshop.md](weighting-workshop.md)); the session itself has not happened.
- **Still failing:** S3b and S5. Both pass if two evidence-backed score changes (P1, P2 in the proposals doc) are accepted. Not applied.
- **New observation:** with the draft questions, Power BI wins about 86% of random clients (was 78%), because the deck's own heatmap rates it highest on cost and talent.

## 1. How this was validated, and its limits

- **Reference engine** implementing the Flow method exactly; all analysis runs on `data/questions.json`.
- **Cross-checks against the deck**: migration grid (slide 28), deployment table (slide 22), capability heatmap (slide 8),
  decision tree and client scenarios (slides 19, 20), discovery questions (slides 23, 24, 27).
- **Simulation**: 20,000 uniformly random clients (branching respected) plus 8 coherent client profiles written from deck slide 19/20.
- **Sensitivity**: one-at-a-time and joint +-1 weight perturbation.
- **External research** on weighting methodology and on the vendor facts behind the scores (sources at the end).

Limits you should know about:
- Uniform random clients are a stress test, not reality (real answers correlate). They show structural tilt; they are not a verdict alone.
- The 8 scenarios were authored by me from the deck. They test consistency with the deck, not ground truth. There are no real engagement outcomes to calibrate against.
- Weights cannot be validated as "correct" objectively. What can be tested: sensitivity, double counting, coverage, and consistency with stated intent.
- Vendor facts come largely from vendor docs and secondary sources. Items I could not confirm are marked in section 6.

## 2. Findings

### F1. Branching: Q16-Q20 are wrongly gated on Q13 (my error)
In my earlier proposal I gated Q14-Q20 on "has an active reporting suite". The Flow sheet says the opposite: ask Q14-Q20 for everyone.
Only Q14 (tools in use) and Q15 (migration scale) are about the existing suite.

| Path (Q10, Q13) | Questions asked | Weight kept |
|---|---|---|
| JMAN builds, no BI today | 11 | **52%** |
| Client builds, no BI today | 13 | 61% |
| JMAN builds, has BI | 18 | 91% |
| Client builds, has BI | 20 | 100% |

A client with no BI today is never asked about data estate (Q16), refresh and concurrency (Q18), embedded or external reporting (Q19),
or migration constraints incl. on-prem/residency and budget (Q20). Those are the questions that surface deal-breakers.
No scored option for on-prem/residency, budget or performance is reachable on those paths.
Fix: gate only Q14 and Q15; move Q16-Q20 to Stage `discovery`.

### F2. Power BI has a structural advantage
- Mean score over all options: Power BI **3.39**, Qlik 3.10, Tableau 3.06, Sigma 2.99, ThoughtSpot 2.95, Looker **2.65**.
- Power BI is the top or tied-top score on **65%** of options (others 37-47%). It holds 47 of the 4s; others hold 24-33.
- Random clients: P(#1) Power BI 78%, Looker 1%, Tableau 6%, Qlik 6%, Sigma 5%, ThoughtSpot 4%.
- The deck's decision tree makes ecosystem the root question, yet with Q4 pinned: Google Cloud -> Looker wins only 7.6%; Salesforce -> Tableau 25%;
  hybrid -> Qlik 16%. Weighted result agrees with the tree for 26% of random clients overall.
- Causal test: re-centring each tool to the same mean (diagnostic only, not a recommendation) flips S5 (regulated/hybrid) to Qlik and lifts
  S3a and S2 to 94-100%. So the tilt, not the structure, explains those failures.
- This may be partly real (BARC surveys show Power BI dominating the market), but the deck says "never declare a universal best tool".

### F3. Coverage: five things the deck asks about are not asked
| Deck criterion / question | In the questionnaire? |
|---|---|
| Visualization / presentation-quality need (slide 20 row 2) | No. Q17 "custom visuals" is migration complexity, not need |
| AI / natural-language appetite (slide 24: NL interest, AI strategic, AI-assisted dev) | No. Q09 is AI *governance concern* only |
| Cost sensitivity (slide 24: current spend, cost vs capability) | Only the Q20 "tight budget" option |
| Talent pool / partner availability (heatmap row) | No |
| Number of users (slide 27, item 1.3) | No (Q15 is migration scale only) |

Consequences: scenario S3b (custom dashboards -> Tableau) returns Power BI 100 vs Tableau 90. Scenario S4 (plain-English questions -> ThoughtSpot)
is an **exact tie** with Sigma, 97.5 each.
A traceable source for scoring the new questions exists: the deck's own heatmap rows, rescaled to 1-4.

### F4. Weights
- Sensitivity: +-1 on every weight changes the **#1 pick for 9%** and the **top-3 shortlist for 19%** of clients (worst draw 28%).
  The shortlist is the deliverable, so the weights matter and need a documented basis.
- One-at-a-time: removing Q04 changes #1 for 16% of clients, Q07 for 15%, Q01 for 10%. Q13 has no effect (weight 0, by design).
- Double counting (methodology sources: [EC composite-indicator guide](https://knowledge4policy.ec.europa.eu/composite-indicators/10-step-guide/step-6-weighting_en),
  [redundant criteria](https://www.adaptiveus.com/blog/weighted-scoring-requirements-prioritization/)):
  - Q05 "strict compliance: Yes" and Q09 "AI governance concern: Yes" have **identical score vectors** (correlation 1.00).
  - Governance cluster (Q03, Q05-Q09) = 17 of 56 weight units = **30%**; its "stringent" answers correlate 0.79-0.93.
  - On-prem is scored three times with identical vectors (Q16, Q18, Q20 = 11 weight units) plus Q04 hybrid. A hard constraint should be a filter, not triple-counted soft score.
  - Q01 exit-readiness == Q02 PE/exit stakeholders (same vector); Q11 beginner == Q12 no training; Q06 basic == Q08 no governance.
- Ecosystem has the top weight (5), as the deck's tree intends, but only 11% of total influence, so it does not decide.

### F5. Scores conflict with evidence
- **Power BI on-prem = 4** (Q16, Q18, Q20). Microsoft's guidance says Report Server's feature set is
  [intentionally simple](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-usage-scenario-on-premises-reporting)
  and many service features are [service-only](https://learn.microsoft.com/en-gb/power-BI/report-server/compare-report-server-service). Setting these three to 3
  makes Qlik win S5 by 8 points (95.0 vs 86.7). A reviewer comment asked for 5; the evidence points the other way.
- **Deck slide 22 is inaccurate**: it says Looker and ThoughtSpot have no on-prem option. Looker (original) has a
  [customer-hosted](https://docs.cloud.google.com/looker/docs/choosing-hosting-option) edition (Google Cloud core does not), and ThoughtSpot has a
  customer-managed [Software edition](https://docs.thoughtspot.com/cloud/latest/cloud-and-software-support). Hence hard-excluding them is unsafe; scoring them 2 is a fair hedge.
- **Heatmap divergences** (rho under 0.3, or a tool off by 1.5+ points):
  forecasting (Tableau 1 vs deck 3.2, Sigma 4 vs 1.8; the option is scored as planning/write-back while the deck row is predictive analytics);
  enterprise security (Sigma 2 vs deck 4.0; Looker 4 vs 2.5); custom visuals (Power BI 4 vs 2.5).
- "Fragmented sources / no warehouse" scores 1 for Looker, ThoughtSpot and Sigma. These are prerequisites, not just soft penalties (slide 29 says the warehouse "becomes the real project").
- The scale has no way to express "not viable" (floor is 1); a compensatory sum lets a tool with a blocker still rank high.

### F6. Rationale hygiene
51 numbers quoted in combined rationales disagree with the sheet (they use the old 1-5 scale), across 26 options.
58 of 89 combined rationales discuss three or fewer of the six tools. Per-tool rationales are complete (no cell under 40 characters).
Two review comments remain open (K17, F40).

### F7. A design conflict to resolve
Slide 6 says to "turn answers into a 0-5 weight per category" (client-specific weights, matching the 14-criterion heatmap).
The Flow sheet uses static question weights. These are different models. With static weights a client cannot express
"security is the deciding factor for us" except through its answers.

### F8. Presentation
Normalised scores cannot go below 0.25 (observed 0.42-1.00), which compresses the display. The top two are within 2 points for 26% of random clients
and within 5 points for 58%; the UI must say "too close to call" instead of implying a clear winner.

## 3. What is solid
Q14 migration scores (0/42 mismatches against slide 28). On-prem options match slide 22. Engine mechanics. S1, S2, S3a, S5g and S6 return the expected tool
(each with 8-17 point margins). Q04 ecosystem scores match the decision tree.

## 4. Recommendations, in order
1. **Fix branching** (F1): gate only Q14, Q15 on Q13; Q16-Q20 always asked.
2. **Replace repeated on-prem scoring with a filter**: add one explicit question, "Is a vendor-hosted SaaS acceptable?", and use `Excludes` or a warning,
   not three soft scores. Present Looker (original) and ThoughtSpot Software as "possible with caveats".
3. **Add the five missing questions** (F3), scored from the heatmap rows, each with provenance. This is what turns S3b and S4 into passes.
4. **Re-review Power BI's 4s** against a written 1-4 rubric (4 = native/leading, 3 = strong, 2 = adequate with caveats, 1 = poor or workaround).
   Require a cited reason for any 4. Start with on-prem (4 -> 3), custom visuals, and the high-concurrency row.
5. **De-duplicate governance** and give the AI-governance question its own vector. Interim weights: Q03 1, Q05 3, Q06 3, Q07 2, Q08 2, Q09 1
   (cluster 30% -> about 23%). Effect on winners is small today (82.7% -> 82.0% Power BI); the gain is defensibility.
6. **Run a swing-weighting session** with at least three people (delivery, pre-sales, data architecture): rank the swings, anchor the largest at 100, normalise,
   record dissent ([swing weights](https://dlab.sauder.ubc.ca/sjdm/journal/8430/jdm8430.html)). Re-run the harness; publish the weights as v1 with a review date.
7. **Clean rationales**: remove quoted numbers, cover all six tools, close the two open comments.
8. **UI contract**: show rank plus a fit index `(norm-0.25)/0.75`, a margin, and "too close to call" below the weight-noise level. Show the decision-tree result next to the weighted result and flag disagreement.
9. **Fix the deck**: slide 22 on-prem claims, the Tableau slide's copy-pasted Power BI features, and slide 25's Gartner wording.

## 5. Decisions needed from you
- Static question weights, or client-specific weights as slide 6 describes? (Recommended: static baseline plus an optional "must-have" flag per question.)
- Agree to add the five questions and a SaaS-acceptable filter?
- Who joins the weighting session and the score-rubric review?

## 6. Unverified or conflicting
- Gartner 2026 MQ: Tableau, Qlik and Google/Looker confirm Leader status from their own pages
  ([Tableau](https://www.tableau.com/reports/gartner), [Qlik](https://www.qlik.com/us/news/company/press-room/press-releases/qlik-named-a-leader-for-the-16th-consecutive-year-in-2026-gartner-magic-quadrant-for-analytics-and-business-intelligence-platforms)).
  Microsoft and ThoughtSpot appear only in a [third-party analysis](https://querio.ai/articles/gartner-magic-quadrant-analytics-and-bi-2026-analysis). Sigma was not confirmed. Check Gartner before slide 25 claims it.
- Power BI Report Server licensing: sources conflict on whether Premium Per User grants rights; verify on Microsoft Learn before quoting.
- Power BI Copilot needs paid [Fabric capacity](https://blog.fabric.microsoft.com/en-us/blog/copilot-and-ai-capabilities-now-accessible-to-all-paid-skus-in-microsoft-fabric); qualify "lowest entry cost" on slide 7/9.
- Qlik Predict on client-managed Qlik Sense is described inconsistently ([Qlik](https://help.qlik.com/en-US/cloud-admin-playbook/Content/ai_services/qlik_predict.md)); Qlik Answers is cloud-only per a third-party guide.
- Tableau Cloud vs Server data-residency options: no authoritative source found; verify with Salesforce before relying on slide 22's wording.
- Sigma runs on AWS, Azure and GCP regions chosen when the organisation is created. Sigma's
  [supported regions page](https://help.sigmacomputing.com/docs/region-warehouse-and-feature-support) says the cloud cannot be changed
  or migrated afterwards (read in the audit of 2026-11-23, replacing an address that no longer opens); this supports its score of 2 on residency.

## Sources
Methodology: [EC weighting guide](https://knowledge4policy.ec.europa.eu/composite-indicators/10-step-guide/step-6-weighting_en) ·
[redundant criteria](https://www.adaptiveus.com/blog/weighted-scoring-requirements-prioritization/) ·
[swing weights and scaling](https://dlab.sauder.ubc.ca/sjdm/journal/8430/jdm8430.html) ·
[normalization and ranking stability](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12839561/) ·
[rank reversal](https://arxiv.org/pdf/2508.00129) ·
[BARC selection criteria](https://barc.com/bi-software-selection-criteria).
Vendors: [Looker hosting](https://docs.cloud.google.com/looker/docs/choosing-hosting-option) ·
[ThoughtSpot Cloud vs Software](https://docs.thoughtspot.com/cloud/latest/cloud-and-software-support) ·
[Qlik client-managed vs cloud](https://help.qlik.com/en-US/migration/Content/Migration/differences-qcs-qse.htm) ·
[Sigma regions](https://help.sigmacomputing.com/docs/region-warehouse-and-feature-support) ·
[Power BI Report Server vs service](https://learn.microsoft.com/en-gb/power-BI/report-server/compare-report-server-service).
