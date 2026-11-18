# BI Tools Selection Playbook: page design and content draft

Status: audited 2026-11-17 (section 13) and built as a preview the same day (section 14). This file is the page in reading order, so it can be reviewed as content first and as design second.

## 0. How to read this document

Plain text is the copy that goes on the page. Blockquotes are notes for whoever builds it:
> **Design:** layout, behaviour and visual rules.
> **Data:** which field of `data/questions.json` or the engine feeds the element.

Every non-obvious statement carries an evidence label, so nothing rests on an unstated assumption:

| Label | Meaning |
|---|---|
| **[Deck sN]** | Taken from slide N of the deck. "Edited" means the wording was changed; the change is listed in section 13. |
| **[Flow]** | Taken from the Flow sheet of the workbook. |
| **[Observed]** | Seen in the five marketplace screenshots (the Delivery Playbook and a comparison page). |
| **[Measured]** | Computed from data or pixels by a script (named). |
| **[Engine]** | Behaviour of `src/engine/` that is covered by tests. |
| **[Proposal]** | A design choice made in this draft. It is not a fact and can be changed. |
| **[A#]** | An assumption that has not been confirmed. Listed with how to confirm it in section 12. |
| **[B#]** | A blocking item: the page cannot ship until it is resolved (section 11). |
| **[D#]** | A decision for the owner (section 9). |

**Terminology.** Headings and navigation say **tool** (the title, the Flow and the engine do). Running text may say **platform**, as deck slide 4 does. Tools are always written in alphabetical order in static copy: Looker, Power BI, Qlik, Sigma, Tableau, ThoughtSpot.

---

## 1. The idea in one screen

A consultant opens the playbook, reads two short pages (purpose, principles), answers the discovery questions with a client, and gets a ranked, explained shortlist with the migration effort and a summary they can copy. Reference material sits at the end.

```
 Purpose -> Guiding principles -> Client discovery -> Top-3 shortlist
                                                           |
                                    Existing BI tool and migration required?
                                      yes -> Migration analysis ---+
                                      no  -> use the discovery result
                                                                   v
                                    BI tool finalisation: best-fit recommendation
```
**[Deck s3]** This is the deck's recommendation flow. The Flow sheet adds the opening screen (3.2) and the scoring method, which this draft changes on purpose (section 10). Decision inputs are the deck's four: **business fit, technology fit, governance fit, commercial fit** **[Deck s3]**.

### Page anatomy (desktop)
```
+---------------------------------------------------------------------------------------------+
| Playbook > BI Tools Selection Playbook                                                      |
|  [icon]  BI Tools Selection Playbook                                        [Ask a question] |
|          A guide for choosing and justifying the right BI tool...                           |
|          {read time} . v1 draft . Updated {date}      [INTERNAL USE ONLY]   Owner {TBC}      |
+---------------------------------------------------------------------------------------------+
| Overview | Purpose | Guiding principles | Client discovery | Shortlist | Migration analysis | ... |
+---------------------------------------------------------------------------+-----------------+
|                                                                           | On this page    |
|   page content (sections 3.2 to 3.10)                                     |  ...            |
|                                                                           | ----------------|
|   Client discovery: question cards                                        | Your answers    |
|   Shortlist: ranked cards, lead strength, reasons                         |  7 of 22 asked  |
|                                                                           |  Provisional    |
+---------------------------------------------------------------------------+-----------------+
```
> **Design:** the hero band with breadcrumb, title, description and meta, the owner chip, the "Ask a question" button, the tab row, "On this page", "Was this page helpful?", previous/next cards and the question form are all **[Observed]** on the Delivery Playbook. Whether the tab row stays fixed while scrolling, and whether each tab is a separate page, cannot be seen in screenshots **[A2, A3]**. The previous/next cards suggest tabs are separate sub-pages. **Revised 2026-11-18 on the owner's request [D17]:** the playbook is one continuous scrolling page; the tab row jumps to each section and shows which one is in view, so nothing is hidden behind a click.

---

## 2. Visual language

**[Observed]** colours were sampled from pixels of the five screenshots **[Measured]**, using a small PNG decoder (no image library was available). They are close to, but not identical with, the deck's theme.

| Role | Marketplace (measured) | Deck theme | Use |
|---|---|---|---|
| Deep indigo | `#1E0D58` | `#19105B` | Headings, hero band, primary text |
| Purple | `#3C069E` | `#3411A3` | Buttons, active tab, selected answer, progress fill |
| Pink | `#FE6796` | `#FF6196` | Decoration and highlights only (see contrast) |
| Teal | `#1F968E` | `#16978E` | Tags such as "Existing Product Fitment"; fills |
| Cyan | `#37D2EE` | `#26D4F0` | Step-number fills |
| Orchid | `#C56CD7` | `#A16BDB` | Step-number fills. Differs visibly from the deck's value |
| Page / card | `#FAFAFA` / `#FFFFFF` | none | Page background; cards with a thin border and generous radius |
| Active nav / info banner | `#E7E2F1` / `#F2F2FE` | none | Selected item; "Questions about this page" banner |

> **Design:** use the marketplace values, since the page lives there. Exact tokens should come from the marketplace stylesheet **[A1]**; the numbers above are measured from screenshots and can be a shade off through anti-aliasing.

### Contrast (WCAG 2.x: 4.5 for normal text, 3.0 for large text and UI shapes) **[Measured]**
| Combination | Ratio | Normal text | Large text / UI |
|---|---|---|---|
| Indigo on white | 16.75 | pass | pass |
| Purple on white (and white on purple) | 12.27 | pass | pass |
| Pink on white | 2.77 | **fail** | **fail** |
| Teal on white | 3.61 | fail | pass |
| Cyan on white | 1.81 | **fail** | **fail** |
| Orchid on white | 3.23 | fail | pass |
| Indigo text on pink / teal / cyan / orchid | 6.06 / 4.64 / 9.27 / 5.18 | pass | pass |
| Pink progress fill on `#FAFAFA` | 2.65 | n/a | **fail** |
| Purple progress fill on `#FAFAFA` | 11.75 | n/a | pass |

Rules that follow:
- Text is indigo or purple on light, or white on indigo or purple. Pink, teal, cyan and orchid never carry text on white; if they carry text it is indigo.
- **The progress bar is purple, not pink.** Pink is decoration only.
- The marketplace's own lighter pills fail AA (white text on `#957DF9` is 3.19, on `#988DDB` is 2.93). This page does not copy them.
- Colour is never the only signal; words and shapes carry meaning.

### Components
- **Cards** with a title, one-line subtitle and content; numbered circles for steps; a chevron step bar for the discovery sections **[Observed]**.
- **Fit pills** show how well a tool fits one answer. Each uses a combination that passes AA **[Measured]**:

| Pill | Fill | Text | Ratio |
|---|---|---|---|
| Strong fit | `#1E0D58` | white | 16.75 |
| Good fit | `#3C069E` | white | 12.27 |
| Suitable | `#E9E4FA` | indigo | 13.51 |
| Possible but not ideal | `#F3F0FA` | indigo | 14.88 |

  **[Proposal]** The word comes from the answer's absolute fit (a number from 1 to 4, averaged for multi-select): 3.5 or more is Strong fit, 2.5 or more Good fit, 1.5 or more Suitable, below that Possible but not ideal. The four words are the workbook legend's own wording **[Flow]**; the cut-offs are not yet confirmed **[A11]**.
- **All six tools look identical.** One neutral card style, name only, same size. No brand colours and no logos, because logos give some brands more visual weight **[Proposal, D7]**. Tool tiles are never ordered by anything except rank, then alphabetically.
> **Design:** use the marketplace typeface; do not introduce a second font **[A1]**.

---

## 3. Page content, in reading order

### 3.1 Hero and navigation

- **Breadcrumb:** Playbook › BI Tools Selection Playbook **[Observed pattern]**
- **Title:** BI Tools Selection Playbook **[Deck s3 to s6 (each slide title starts with it)]**
- **Description:** A guide for choosing and justifying the right BI tool for each client engagement: Looker, Power BI, Qlik, Sigma, Tableau or ThoughtSpot. **[Deck s4, edited: tool list reordered alphabetically]**
- **Meta:** {read time, as the marketplace computes it} · v1 draft · Updated {date} · badge **Internal use only** · Owner {to be confirmed}. The marketplace meta line shows read time, version, update date and view count **[Observed]**; none of our values is known yet, so none is invented here.
- **Button:** Ask a question **[Observed]**
- **Sections, in the order of the deck's contents slide** **[Deck s2]**, with this draft's two additions. They run one after another on a single page; the tab row is a set of jump links that follows the reader's position **[D17]**:

| Section | Source |
|---|---|
| Overview | **[Flow]** opening screen; added |
| Purpose | **[Deck s2]** 1 Playbook Purpose |
| Guiding principles | **[Deck s2]** 2 General Guiding Principles |
| Client discovery | **[Deck s2]** 3 Client Requirement Discovery |
| Shortlist | **[Deck s3]** step 4 "Top 3 Shortlist" |
| Migration analysis | **[Deck s2]** 4 Migration Analysis |
| Tool details | **[Deck s2]** 5 Detailed BI Tool description (for top 3 BI) |
| Final recommendation | **[Deck s2]** 6 BI Tool Finalization (Best Fit) |
| Reference | added |

Nine sections, as many as the Delivery Playbook has tabs **[Observed]**.

> **Design:** the deck marks 16 of its 29 slides "Internal purposes only" **[Measured]** and slide 4 says the playbook is not for the client to read end to end **[Deck s4]**. Keep the badge in the hero and in the footer of every printed summary.

### 3.2 Overview

**Heading:** BI Tools Selection Playbook

**Start here** (the three options the Flow shows when the playbook opens **[Flow]**):

1. **Playbook Purpose.** A short read.
2. **General Guiding Principles.** A short read.
3. **Client Requirement Discovery.** Questions with preset answers.

**How the recommendation flow works** (the deck's flow cards **[Deck s3]**):

1. **Playbook purpose.** Guide consistent BI tool selection. Support sales and delivery decisions.
2. **Guiding principles.** Business problem first. Client-specific, evidence-led decisions.
3. **Client discovery.** Apply weighted questions across business, governance and readiness.
4. **Top 3 shortlist.** Rank all six tools. Deep-dive the three highest scores.

Decision node: **Existing BI tool and migration required?** *Yes:* Migration analysis. *No:* Use discovery result (retain the top-ranked recommendation from the weighted assessment). Both lead to **BI tool finalisation: best-fit recommendation** **[Deck s3]**.

**Decision inputs:** Business fit · Technology fit · Governance fit · Commercial fit **[Deck s3]**.

Footnote, verbatim from the deck: *The shortlist is a starting point. Migration effort only changes the answer when the cost, risk or lost investment outweighs the incremental fit.* **[Deck s3]**
Added line (this tool's handling, see 3.7): *In this tool, migration effort is shown next to the fit. You weigh it; it does not change the ranking on its own.* **[Proposal, D4]**

**Primary button:** Start client discovery.

### 3.3 Purpose

**Heading:** Purpose · badge: Internal purposes only **[Deck s4]**

**Statement:** A guide for BI tool selection, helping delivery teams choose and justify the right platform for each client engagement. **[Deck s4, edited: tool list omitted]**

Four cards **[Deck s4, lightly edited: UK spelling, "POC" spelled out, "again" dropped]**:

- **Audience: who should use this.** Sales, pre-sales and delivery teams scoping or pitching a BI implementation. It is written for the consultant making the recommendation, not for the client to read end to end.
- **When to use it.** During discovery and solution design, before a tool is shortlisted and before scope or pricing is finalised. Revisit it at renewal, expansion or migration conversations.
- **What decisions it supports.** Which BI tool or tools to shortlist or recommend for a specific client, and how to justify that recommendation with a clear, criteria-based comparison rather than a sales pitch.
- **What it does not replace.** A hands-on technical proof of concept, a licensing or contract negotiation, or a formal RFP response. It is a starting point for judgment, not a substitute for it.

Callout (the marketplace's own info-banner colour, `#F2F2FE`): **Platform facts and pricing.** Feature sets and pricing change frequently. Verify current details before quoting a client, and flag anything you find out of date. **[Deck s4, edited]** Link: *Report something out of date.*

> **Data:** the link would open the marketplace's *Report an issue* form, which exists **[Observed]**; pre-filling it with the section is **[A5]**.

### 3.4 Guiding principles

**Heading:** Guiding principles
**Lead:** The mindset behind every recommendation in this playbook. Read this before the discovery questions. **[Deck s5]**

**Do** **[Deck s5, verbatim]**
- Start with the business problem, not the preferred technology.
- Assess the client's existing ecosystem before recommending change.
- Separate mandatory requirements from preferences.
- Validate vendor product claims against the client's actual requirements.
- Use a proof of concept for high-risk assumptions.
- Document trade-offs and the rationale behind the decision.

**Don't**
- Avoid declaring a universal "best BI tool." The right answer is always client-specific. **[Deck s5, verbatim]**
- Don't hand the questions or the result to the client to read end to end. They are internal working material. **[Proposal [A13]: derived from slides 4 and 6]**
- Don't quote pricing or feature claims without checking they are current. **[Proposal [A13]: derived from slide 4]**

**Card: How this tool keeps the recommendation neutral**
The ranking comes only from the answers you give. Each tool is measured against a neutral starting point on every question, so a tool that scores well everywhere gains no automatic advantage. Ties are broken by your answers and otherwise shared, never by list order. Tools are always listed by rank, then alphabetically. The principle above applies to the tool too: it never declares a universal best. **[Engine; method in `docs/scoring-method.md`]**
> **Design:** keep this card short and visible, with a link *How scoring works* to a plain-language version of `docs/scoring-method.md`. "Neutral starting point" is exact: for questions that have a "not a priority" answer it is that answer, for the others it is the tool's own average across the possible answers.

### 3.5 Client discovery

**Heading:** Client discovery
**Lead:** For internal use during discovery calls and account planning, not a document to hand to the client. Ask these to understand the client well enough to compare the tools fairly. **[Deck s6, edited: the deck says "to weight the recommendation correctly"; this tool uses fixed question weights, D5]**

Three steps **[Deck s6 has Ask, Weight, Decide; replaced, D5]**:

1. **Ask.** Work through the questions with the client, or from what you already know about the account.
2. **Review.** Check your answers and what is still open in the panel on the right, and see how the tools compare in the shortlist.
3. **Decide.** Use the ranking, the lead strength and the reasons. Where it is close, run a proof of concept.

**Five sections**, all on the page one after another, each with a banner showing how many of its questions are answered; a row of jump links above them shows a tick on a section when every visible question in it is answered or marked "not sure yet" **[Proposal, D2, D17]**. There are 26 questions in all, 22 are asked at the start, and 9 multi-select questions (only Q01, Q02 and Q06 are specified as multi-select by the Flow; the other six are **[A7]**):

| # | Section | Questions | What it covers |
|---|---|---|---|
| 1 | Business context and goals | 8 | What the client wants from BI, who uses it, which ecosystem they live in, and what matters most: polish, AI, cost, number of users |
| 2 | Data, security and governance | 6 | Compliance, security and access, whether a vendor-hosted tool is acceptable, semantic layer, governance maturity, AI governance |
| 3 | Skills and change readiness | 4 | Who builds the reports, their skill, how much training the client can support, talent availability |
| 4 | Existing reporting | 3 | Whether the client has BI today, which tools, how much |
| 5 | Data landscape and delivery | 5 | Data estate, complexity of existing content, refresh and performance, embedded or external reporting, migration constraints |

> **Design:** the Flow has four sections **[Flow]**; splitting its section 4 matters because Q16 to Q20 are asked of everyone **[Engine]**. Q17 ("existing content") and Q20 ("migration constraints") are worded for a migration yet asked of clients with nothing to migrate **[B2]**. The full question list is in the appendix.

#### A question card
```
+------------------------------------------------------------------------------+
|  QUESTION 7 OF 22   [Draft]                                    Choose one     |
|  How much does licensing cost drive the decision?                             |
|  How much price should count when choosing between tools.   <- guide line     |
|                                                                              |
|  +----------------------+ +----------------------+ +----------------------+  |
|  | (o) Tight budget     | | (o) Balanced         | | (o) Cost is not the  |  |
|  |     Cost reduction   | |     Will pay for     | |     main factor      |  |
|  |     is the main ...  | |     clear capability | |     NOT SCORED       |  |
|  +----------------------+ +----------------------+ +----------------------+  |
|                                                                              |
|  + Add a note for this client                                                 |
+------------------------------------------------------------------------------+
```
Answers are tiles. Up to three scored answers sit side by side in one bar; four or more fill a grid that wraps to the width of the screen. An answer written "Title: detail" or "Title — detail" in the workbook is split into a bold title and a lighter line, using only the workbook's own words **[Engine: `splitLabel`, tested]**.
- **Numbering** is the position among the questions asked now ("Question 7 of 22"), not the internal Q ID. The total changes as branches open or close **[Engine: `Session.visible()`]**.
- **Choose one / Choose all that apply** on every card, as a chip in the top right; single answers have round marks and multiple answers square marks with a tick.
- **"Not sure yet" style.** Answers that carry no information ("Other / Not yet defined", "To be confirmed", "Not a priority", and the small user counts) are shown as a quieter secondary option with the note *Not scored. It does not help or hurt any tool.* **[Engine: unknown answers are skipped]**
- **A one-line guide** under every question says what it is asking. It restates the question and its answers and never names a tool or mentions scoring (a test enforces both). All 26 are proposed wording **[A17]**. The Flow's own help text, where it exists (Q06's facilitator instruction, *Ask this for every client, regardless of Q5*, and Q10's branch note) appears beneath it as a marked note **[Flow]**. A real "Why we ask" for each question still has to be written (section 8).
- **Draft tag** on questions whose scores await review, with a tooltip; hidden once approved **[Proposal, D9]**.
- **Note** is a free-text field per question. Notes appear in the exported summary and are never sent anywhere **[Proposal; a requirement on the build]**.
- **Keyboard:** every tile is a real radio button or checkbox inside its label, so arrow keys, space and enter work, and the focused tile shows a purple outline **[Proposal; structure tested, the keyboard itself not driven in a browser]**.
- **Answer order is neutral too.** Options that name tools or ecosystems (the tools-in-use question and the ecosystem question) are shown alphabetically, with "Excel / Other", "Hybrid", "None" and "Not sure yet" last, because the first option listed can prime a choice **[Proposal]**. The workbook's order starts with Power BI and Microsoft **[Measured: `data/questions.json`]**, so the page must re-sort. Questions with a natural order keep it. Display only.
> **Data:** `Session.visible()` returns each question with its options, type, status and current answer. `Session.answer(qid, optionIds)` validates the answer and returns `{pruned}` **[Engine, tested]**.

#### Branches **[Flow, Engine]**
- Choosing **Client team** or **Joint delivery** for "Who will build the reports?" reveals two questions: the delivery team's skill level and how much training the client can support. Choosing **JMAN** keeps them hidden **[Flow Q10 branch rule]**.
- Choosing **Yes** or **Partial / Departmental only** for "Does the client have an active reporting suite?" reveals "Which BI tools and licences are currently in use?" and "What is the migration scale?". This departs from the Flow, which asks them of everyone and records "None" where not applicable **[D11]**.
- When an answer closes a branch, the answers behind it are cleared and a quiet notice says so, with **Undo**: *Your answers to the skill-level and training questions were cleared because JMAN will build the reports.* **[Proposal; `answer()` returns the cleared question IDs, Undo is kept by the page]**

#### The right rail while answering: "Your answers"
- **Progress:** "7 of 22 questions answered" with a purple bar. 22 are asked at the start; the total moves as branches open or close.
- **State label** (see 3.6).
- **Matters most, still open:** unanswered questions ordered by weight, highest first, each a link to the question. The weights only order the list; they are not shown. Needs a small engine addition **[section 6]**; weights are provisional **[B7]**.
- **Start over**, and a note *Saved on this device.*

### 3.6 Shortlist

**Heading:** Top 3 shortlist
**Lead:** Based on your answers, here is how the six tools compare for this client.

The panel has four states, driven by how much of the visible question weight is answered **[Proposal, D6; evidence in section 13, row 8]**:

| State | When | What it shows |
|---|---|---|
| A. Nothing scored | No scored answer yet | *Answer a few questions to see how the tools compare.* and the "Matters most, still open" list |
| B. Provisional | Under 80% of the visible weight answered | The ranking, tagged **Provisional**, with *Based on {n} of {m} questions. The order is likely to change as you answer more.* |
| C. Near complete | 80% up to, but not including, all of it | The ranking with *Based on {n} of {m} questions. The order can still change.* |
| D. Complete | Every visible question answered or marked not sure | The ranking with *Based on all {m} questions.* |

Why 80%: in the simulation, a partial ranking had the same leader as the final one in 31%, 42%, 50% and 61% of simulated clients when 0-20%, 20-40%, 40-60% and 60-80% of the weight was answered, and in 85% when 80% or more was answered; the same top three in 17%, 26%, 32%, 49% and 78%. **[Measured: `scripts/calibrate_thresholds.py` section C.]** The simulated clients answer at random, and real clients may converge faster **[A9]**, so no percentage is shown to the user.

**Lead strength** (engine: `leadStrength`, from the lead of the first tool over the second, in z) **[Engine, tested; thresholds Measured]**:

| Lead | Meaning | Evidence: the leader stays first when every weight is nudged by up to 1, up or down |
|---|---|---|
| Clear: 0.5 z or more | *{Tool} fits this client best, with a clear lead over {Tool}.* | 98% of simulated clients |
| Narrow: 0.3 up to 0.5 z | *{Tool} fits best, but only narrowly ahead of {Tool}. Treat the top two as a pair.* | 87% |
| Too close: below 0.3 z, or a tie | *{Tool} and {Tool} fit equally well on these answers. Use a proof of concept to separate them.* | 64% below 0.3 |

While the result is provisional, every lead sentence starts with "So far," and the summary says "Best fit so far", so a headline never sounds surer than the answers given so far can justify **[Engine and page, tested]**.

The constants are `TOO_CLOSE_Z = 0.3` and `CLEAR_LEAD_Z = 0.5` in `src/engine/engine.js`. They were derived by `scripts/calibrate_thresholds.py` with the provisional weights and **must be re-derived after the weighting session** **[A10]**. Under 0.3 z the leader held only 54% to 72% of the time depending on the band, which is why an earlier, lower threshold was replaced.

**The shortlist boundary.** The three tools shown are those with rank 3 or better, which can be more than three when ties span the cut **[Engine: `shortlist`]**. Whether the third tool is clearly ahead of the first one left out is a separate question **[Engine: `shortlistBoundary`]**: the top-three set stayed the same under the same weight noise in 97% of simulated clients when the gap was 0.5 z or more, 83% between 0.3 and 0.5, and 57% below 0.3 **[Measured: `scripts/calibrate_thresholds.py`]**. So the page adds, when the boundary strength is not clear: *{Tool} is almost level with the third tool. Consider it as well.* A tool is never presented as "the three that fit best" without this check.

Always shown: *Based on {n} of {m} questions.*

**The shortlist: tool cards** (identical style; equal ranks side by side, alphabetical). Each card shows:
1. **Rank badge** (1, 2, 3; ties show "=1"; no percentage, no score).
2. **Tool name.**
3. **Fit bar:** relative fit, how far this tool's fit to your answers is above what it would score for a client who told us nothing. Caption: *Relative fit. Compared with a neutral starting point.* The numbers are in a "Details" drawer for consultants **[D15]**.
4. **Strongest reasons** (up to 3): a fit pill for the answer (section 2), the client's answer in bold, the question as context, and the SME rationale for that tool. A line under the heading says: *Answers that count in this tool's favour. The word shows how well it fits that answer on its own.*
5. **Watch-outs** (up to 3), same format, with the line *Answers that count against this tool, even where it still fits reasonably.* A watch-out can carry a Good fit word: the word is the fit for that answer on its own, the watch-out is relative to the neutral starting point. These are the "risks" the Flow asks for **[D15]**.
6. **Rank note**, only when it applies: *Ranked below {Tool} because {Tool} fits at least as well on every answer you gave.*
> **Data:** `result().shortlist`, `shortlistBoundary`, `leadStrength`, `adjustedByDominance`; `Session.explain(toolId, 3)` returns `strengths` and `concerns`, each with `answer`, `why` and `absoluteFit` **[Engine, tested]**.

**Ruled out by your answers** (only when relevant): a card per excluded tool giving the question, the answer, and the SME's rationale for that tool on that answer. Today **one answer rules a tool out**: "Is a vendor-hosted (SaaS) BI platform acceptable?" answered "No: must run on-premises or on client-controlled infrastructure" rules out Sigma **[Measured: `data/questions.json`]**. The Flow asks for mandatory-constraint filters on security, residency, external access, ecosystem and deployment **[Flow]**; the others are not implemented **[D14]**. So the "every tool ruled out" state in section 4 cannot occur with the current data.

**Other tools** (collapsed): ranks below the shortlist, each with its single biggest watch-out.

**Banners**
- **Draft questions in use:** *This result uses draft questions ({list}). Their scores are awaiting review.* Shown only when `usesDraftQuestions` is not empty **[Engine]**.
- **Facts:** *Verify current platform details and pricing before quoting a client.* **[Deck s4]**

**Actions:** Review answers · Compare tools · Copy summary · Start over

> **Design:** announce changes to the ranking in a polite `aria-live` region and delay updates by a short time (about half a second, **[Proposal, untested]**) so the list does not flicker while someone is still selecting. Do not animate cards past each other.
> **Neutrality rules (non-negotiable):** list tools by rank, then alphabetically; show tied leaders as co-leaders; never show the engine's absolute fit as a rank; never use the sheet's or the deck's order.

### 3.7 Migration analysis

Shown only when the client has existing reporting ("Yes" or "Partial / Departmental only"). When the client has none: *No existing reporting to migrate. The discovery result stands.* **[Deck s3: "Use Discovery Result"]**

**Heading:** Migration analysis
**Lead:** Basic effort rating (Low, Medium, High) across six migration dimensions. Use this to scope the effort, not just to pick the destination tool. **[Deck s16, edited]**

1. **From your answers:** the tools currently in use, as chips. For each shortlisted tool, the feasibility of moving from each current tool (**Easy / Moderate / Hard**) with two reasons from the deck, for example *From Looker to Power BI: Hard. The LookML semantic layer investment is lost entirely. Governed metrics must be rebuilt as DAX measures.* **[Deck s17]** Excel is supported as a starting point **[Deck s28]**.
2. **Effort by dimension** for the shortlisted tools, over the deck's six dimensions: data model rebuild, report and dashboard rebuild, user retraining, historical content migration, parallel-run complexity, time to full cutover **[Deck s16]**.
3. **Typical challenges** per shortlisted tool **[Deck s29]**.
4. **Full feasibility grid**, collapsed, from-rows and to-columns **[Deck s28]**.

Note under the section: *Migration feasibility already shapes the ranking through the "tools in use" answer. This section explains it and adds effort detail; it is never counted twice.* **[Engine: Q14's scores match the deck's grid exactly, 0 of 42 differences, `scripts/validate_model.py`]**

> **Data:** feasibility, effort and challenge tables exist only in the deck (slides 16, 17, 18, 28, 29) and must be extracted to `migration.json`. "Tools in use" is `Session.answers.Q14`.
> **Departure from the deck:** slide 3's migration box ends in a "Migration-adjusted score" **[Deck s3]**. This draft shows effort beside the fit and leaves the weighing to the consultant **[Proposal, D4]**.

### 3.8 Tool details

**Heading:** The tools on your shortlist
**Lead:** A closer look at each tool on your shortlist, in rank order. Equal ranks are shown alphabetically.

Tabs for the shortlisted tools. Each shows, from the deck's profile slides **[Deck s10 to s15]**:
- **Introduction** (one paragraph).
- **Typical features · Unique features · Benefits · AI capabilities · Cost tier.**
- **Best suited for** (one sentence).
- **Last verified** date and *Report something out of date.* (the date does not exist yet, section 8).

**Compare tools.** A picker for any two tools, or one against all five others **[Deck s12 note: "Have a 6v6 matrix, 1 tool comparison to all other"]**, over the deck's **14 criteria in five groups**: Business adoption (3), AI and analytics (2), Enterprise readiness (3), Technology and integration (3), Commercial and business value (3) **[Measured: slides 7 and 9 hold seven criteria each; slide 8's heatmap shows the same 14]**. Criteria linked to the client's answers are highlighted first with the label *Relevant to your answers*, which is the deck's note that the matrix should appear based on the questionnaire answers **[Deck s7 note]**.

> **Data:** profile text and the 14 by 6 matrix text exist only in the deck; extract to `tools.json` and `matrix.json`, and map each criterion to the questions that relate to it (a first mapping exists in `scripts/validate_model.py`). The deck's Tableau profile repeats Power BI's "typical features" (Power Query, DAX) **[Measured: slide 11 text]**; fix it before it ships.

### 3.9 Reference

Collapsed sections. Nothing here changes the recommendation.

| Section | Source | Note |
|---|---|---|
| **Patterns we see** (client scenario, typical starting point, why) | **[Deck s20]**, six scenarios | Add *These are starting points. The questionnaire result takes precedence.* |
| **Fast path by ecosystem** | **[Deck s19]** | A table of ecosystem to typical tool, not the deck's "stop at the first Yes" list **[D3]**. |
| **Deployment considerations** | **[Deck s22]** | Correct first: Looker (original) has a customer-hosted edition ([Looker hosting options](https://docs.cloud.google.com/looker/docs/choosing-hosting-option)) and ThoughtSpot has a customer-managed Software edition ([ThoughtSpot Cloud vs Software](https://docs.thoughtspot.com/cloud/latest/cloud-and-software-support)); the slide says neither has an on-premises option. |
| **Technology integration** | **[Deck s21]** | Covers four tools (Power BI, Tableau, Looker, ThoughtSpot). Add Qlik and Sigma. |
| **Decision matrix** and **visual summary** | **[Deck s7, s8, s9]** | Same data as the compare tool. |
| **Why these six tools** | **[Deck s25]** | The slide says "four platforms" and cites the Gartner Magic Quadrant. Update to six and re-check the Gartner wording: vendor pages confirm Leader status for Tableau, Qlik and Google (Looker); for Sigma it was not confirmed (`docs/model-validation.md` section 6). |
| **How scoring works** | `docs/scoring-method.md` | Plain-language rewrite. |

### 3.10 Final recommendation

**Heading:** BI tool finalisation: best-fit recommendation **[Deck s3]**
Generated, copyable and printable. The deck's footer line is **recommended platform · rationale · trade-offs · migration implications · next validation step** **[Deck s3]**. The Flow's final step asks for the top three with "normalized score, key fit, constraints, delivery risk and migration effort" **[Flow]**. Both are covered by this mapping **[Proposal, D15]**:

| Deck / Flow term | In the summary |
|---|---|
| Recommended platform; top three | Best fit, and the other shortlisted tools |
| Rationale; key fit | "Why {Tool}": the answers that favoured it, with the SME rationale |
| Trade-offs; delivery risk | "Watch-outs": the answers that held it back |
| Constraints | "Ruled out" plus the client's own answers to the constraint questions |
| Migration implications; migration effort | The migration section's feasibility and effort |
| Normalized score | "Fit index" in details (the engine's z), never as a percentage |
| Next validation step | A proof-of-concept prompt and the fact-check reminder |

```
BI tool recommendation          INTERNAL USE ONLY            {date}
Client: {typed by the consultant}
Status: {Provisional, based on 17 of 22 questions | Complete, all 22 questions}

Best fit: {Tool}      ("Best fit so far:" while provisional; or: {Tool} and {Tool} fit equally on these answers)
Lead: {clear | narrow | too close to call}
Also on the shortlist: {Tool}, {Tool}        ({Tool} is almost level with the third)
Ruled out: {Tool}: {question} answered "{answer}"

Why {Tool}
- {question}: {answer}. {rationale}
Watch-outs
- {question}: {answer}. {rationale}
Constraints you told us about
- {question}: {answer}
Migration implications
- From {current tool}: {Easy | Moderate | Hard}. {reasons}
Next validation step
- Run a proof of concept on {highest-risk assumption}. Verify pricing and licensing before quoting.

Answers and notes
- {section}: {question} - {answer}  (note)
```
- Buttons: **Copy as text** · **Print or save as PDF** (print stylesheet) · **Download answers** (a small file to restore later) **[Proposal, D10]**.
- The client name is typed by the consultant for the printout only and is not stored **[Proposal]**.
> **Design:** the summary must make ties and "too close to call" explicit rather than naming a single winner.

### 3.11 Feedback footer (marketplace pattern)
*Was this page helpful?* Yes / No · previous and next cards · *Questions about this page?* with the owner's name · *Have a question about the BI Tools Selection Playbook?* with the Question, Suggestion, Report an issue and Comment types. **[Observed]** If the shell provides these they are not built here **[A1]**.

---

## 4. States and edge cases

| State | What the page does |
|---|---|
| First visit | Overview open; discovery shows question 1; right rail says "0 of 22 answered" |
| Returning | Restores saved answers with *Saved on this device. Start over?* |
| Nothing scored yet | Shortlist shows State A |
| Tied leaders | Co-leader cards side by side, alphabetical, "Too close to call", proof-of-concept hint |
| Lead narrow | The narrow-lead sentence and the boundary check |
| Every tool ruled out | *Your answers rule out all six tools. Review: {the answers that excluded each}.* Cannot occur today: only one filter exists **[D14]** |
| Branch closes | Answers cleared with an Undo notice |
| Draft questions in use | Banner naming them |
| Data failed to load | *The playbook data could not be loaded. Try again.* with a retry button; no partial ranking |
| Print | Summary only, with the internal-use badge |

## 5. Accessibility, privacy and performance
- **Keyboard and screen readers:** every control reachable by keyboard; question groups use fieldset and legend; the shortlist is an `aria-live="polite"` region; colour is never the only signal **[Proposal]**.
- **Contrast:** only the combinations in section 2 that pass are used **[Measured]**. Respect reduced-motion **[Proposal]**.
- **Mobile:** the tab row scrolls sideways, stays at the top and keeps the current section in view; the right rail becomes a collapsible panel that starts collapsed at 980 px and narrower, with a one-line summary that stays visible (for example "10 of 26 · Provisional") and a state that is kept across updates; cards stack with a 16 px side gutter **[Proposal; built and checked at 375 px with no horizontal overflow]**.
- **Privacy:** the module keeps answers and notes in the browser only, sends them nowhere, and does not store the client name **[Proposal; a requirement on the build]**. The marketplace shows page view counts **[Observed: "481 views in 3 months"]**; what else its analytics collect is not known, so confirm that nothing in the shell can capture answers **[A6]**.
- **Performance** **[Measured]**: the engine and session scripts total 20.2 KB, the data is 186 KB (31 KB compressed); `result()` takes about 0.03 ms and `explain()` about 0.02 ms in Node on the development machine, so results update live without a server.

## 6. What the engine provides
**[Engine, tested]** `Session.visible()`, `answer()`, `clear()`, `progress()` (with `coverage`), `openQuestions()`, `result()`, `explain()`, `toJSON()` and `fromJSON()`. `result()` returns `state`, `coverage`, `ranking`, `shortlist`, `shortlistBoundary`, `margin`, `leadStrength`, `tooCloseToCall`, `coLeaders`, `adjustedByDominance`, `excluded` (with the answer and the SME rationale), `usesDraftQuestions` and the counts. The state (`none`, `provisional`, `near`, `complete`) follows coverage at the calibrated line `NEAR_COMPLETE_COVERAGE`. The page's own logic (neutral answer order, fit words, lead sentences, summary text) is in `src/page/lib.js` and is unit-tested. Nothing is left to build in the engine for the page as designed.

See `docs/engine.md`.

## 7. Build plan (steps 1 to 5 built as a preview, see section 14)
1. Static content module: overview, purpose, principles, reference (no scoring).
2. Discovery questionnaire with branching and the "Your answers" rail, wired to `Session`.
3. Shortlist and final recommendation with export.
4. Migration analysis and tool details (needs the extracted data).
5. Polish: states, mobile, accessibility pass, print.
Each step is usable alone and can be reviewed in the marketplace preview **[A4]**.

## 8. Content and data still to prepare
| Item | Source | Status |
|---|---|---|
| "Why we ask" help text, one line per question (26) | Two exist in the Flow (Q06's instruction and Q10's branch note) and are used | To write the other 24 |
| Section names and descriptions for the five sections | this draft | To approve [D2] |
| Tool profiles (6) as data | Deck slides 10 to 15 | Extracted to `data/deck/profiles.json`; Tableau's typical features withheld (the slide repeats Power BI's) |
| Decision matrix text (14 criteria by 6 tools) with the deck's "leads" markers | Deck slides 7, 9 | Extracted to `data/deck/matrix.json` |
| Criterion-to-question mapping (for "Relevant to your answers") | `src/page/playbook.js` | First version built [A14]; SME review |
| Migration data: feasibility, effort, challenges | Deck slides 16, 17, 18, 28, 29 | Extracted to `data/deck/migration.json`; the 30 cards agree with the deck's own grid |
| Scenarios, fast path, deployment, integration | Deck slides 19 to 22 | Extracted to `data/deck/reference.json`; slide 22 corrected on the page with vendor sources; slide 21 shown as text only |
| "Last verified" dates for tool facts | none | To create |
| Owner, version, read time | none | To confirm |
| Score review for the six draft questions and open proposals | `docs/proposed-score-changes.md` | SME review |
| Question weights | `docs/weighting-workshop.md` | Session to hold |
| Confidence thresholds (0.3 and 0.5 z) and coverage states | `scripts/calibrate_thresholds.py` | Re-run after the weights change |

## 9. Decisions needed
Each shows a recommendation. None is applied unless stated.

- **D1. Shell and structure.** Does the marketplace provide the hero, tab row, "On this page", helpfulness row, previous/next and Q&A, and are tabs separate pages? Can it host a self-contained module of plain scripts? *Recommended: build only the content area as plain scripts, all sections on one scrolling page [D17], answers kept in browser storage.* [A1 to A5]
- **D2. Five sections instead of the Flow's four.** *Recommended: yes.*
- **D3. Decision tree (deck slide 19).** It stops at the first "Yes" and tests Microsoft first, so a client that fits more than one rule is always sent to the earlier one. *Recommended: a table of ecosystem to typical tool in the reference section; never a driver, and not a cross-check beside the result.*
- **D4. Migration-adjusted score (deck slide 3).** *Recommended: show effort beside fit, never re-rank, because the "tools in use" answer already carries migration feasibility.*
- **D5. Weights.** Deck slide 6 says weights are set per client; the model uses fixed question weights. *Recommended: fixed, with an optional "must-have" flag per question later.*
- **D6. Coverage states.** *Recommended: the four states in 3.6 with the 80% line, shown without percentages to the user.* Evidence is from simulated clients only [A9].
- **D7. Logos.** *Recommended: none; uniform name tiles.*
- **D8. Notes per question** exported with the summary. *Recommended: yes.*
- **D9. Draft questions in production.** *Recommended: hide them until approved (`--exclude-draft`), but note that this build also loses the two SME-scored options that moved into Q23 and Q26 (`docs/proposed-score-changes.md`).*
- **D10. Export.** *Recommended: copy as text, print to PDF, download answers; no server.*
- **D11. Q14 and Q15 gating.** The Flow asks Q14 to Q20 of everyone and records "None" where not applicable **[Flow]**. Q14 (tools in use) has no "None" answer, so a client with no BI cannot answer it. *Recommended: keep the gate, or add "None" answers to Q14 and Q15 and ungate.*
- **D12. Greenfield wording.** Q17 ("How complex is the existing content?") and Q20 ("What are the migration constraints?") are asked of clients with nothing to migrate **[B2]**. *Recommended: reword for both cases (for example "How complex is the content the client has or needs?" and "What constraints apply to delivery?") and add a "not applicable" answer where needed. SME approval required.*
- **D13. Question wording.** *Applied 2026-11-17: the Flow's wording is used for Q04, Q06, Q07, Q09, Q10, Q11, Q12 and for the Q01 exit-readiness option, as agreed ("the Flow wins for the question list"). Q06's facilitator instruction moves to the help text.*
- **D14. Mandatory filters.** The Flow applies filters for security, residency, external access, ecosystem and deployment before ranking **[Flow]**; only the self-hosted answer filters (Sigma). *Recommended: SMEs list, per answer, the tools that cannot meet it, with evidence.*
- **D15. Final-recommendation fields.** The Flow names "normalized score" and "delivery risk" **[Flow]** and the deck names "trade-offs" **[Deck s3]**. *Recommended: the mapping in 3.10: score in a details drawer, risk as watch-outs.*
- **D17. One page, not tabs.** Decided by the owner on 2026-11-18, replacing the draft's one-section-per-tab design: all nine sections scroll as one page, the tab row and "On this page" jump to a section and follow the reader's position, and an answer redraws only the sections that depend on answers so the reader keeps their place. Whether the marketplace shell can host this is [A1, A2].
- **D16. Q12 answers.** The Flow offers "Limited upskilling capacity" and "No capacity for change"; the model offers "Can upskill". *Recommended: the Flow's four answers, with SME scores for the two missing ones.* [B1]

## 10. Alignment with the Flow sheet
Compared question by question on 2026-11-17 **[Measured]**.

| Flow item | This page | Status |
|---|---|---|
| Opening shows Playbook Purpose (doc to read), General Guiding Principles (doc to read), then Client Requirement Discovery | 3.2 "Start here" | Aligned |
| Questions in four sections | Five sections | Changed [D2] |
| Q01, Q02, Q06 multi-select; Q03, Q04, Q05, Q07 to Q13 single | Same | Aligned (verified) |
| Q14 to Q20 are "Capture" notes with no options or types | Scored options from the workbook; types assumed | Not specified by the Flow [A7] |
| Q10 branch: JMAN skips Q11 and Q12 | Same | Aligned |
| Q13: continue through Q14 to Q20 for every answer, record "None" | Q16 to Q20 for everyone; Q14, Q15 only if Yes or Partial | Changed [D11] |
| Q06: ask for every client regardless of Q5 | Always shown; instruction in help text | Aligned |
| Method steps 1 and 2: score times weight, normalised by each tool's maximum | Standardised z-score | Changed on purpose: raw sums lean to some tools (`docs/scoring-method.md`) |
| Step 3: mandatory-constraint filters first | One filter exists | Gap [D14] |
| Step 4: top three with score, rationale, risks, migration effort | 3.6, 3.7, 3.10 | Aligned with mapping [D15] |
| Step 5: tie-break ecosystem, governance/security, implementation risk and total cost | Implemented; the third group is interpreted as Q10 to Q12, Q20, Q23 | Aligned [A8] |
| Multi-select: average the selected answers | Averaged | Aligned |
| Final recommendation: top three with normalised score, key fit, constraints, delivery risk, migration effort | 3.10 | Aligned with mapping [D15] |
| Question and option wording | Flow wording applied (except Q06's instruction) | Aligned [D13] |
| Answers the Flow lists that are not offered: Q06 "Data residency requirement", Q12 "Limited upskilling capacity" and "No capacity for change" | Skipped by the converter (no scores yet) | **Blocking [B1]** |
| Answer the model offers that the Flow lacks: Q12 "Can upskill" | Offered | Open [D16] |

## 11. Blocking items before the page can ship
- **B1. Three answers from the Flow are not offered**, because they have no SME scores: Q06 "Data residency requirement", Q12 "Limited upskilling capacity", Q12 "No capacity for change". A client with a residency requirement or no capacity for change cannot record it.
- **B2. Q17 and Q20 presuppose a migration** yet are asked of every client; clients with nothing to migrate must answer questions about "existing content" and "migration constraints" [D12].
- **B3. Deck source problems:** the Tableau profile repeats Power BI's typical features (withheld on the page); slide 21's colour markers contradict its legend in 6 cells and it omits two tools (text only is shown); slide 22 says Looker and ThoughtSpot have no on-premises option (corrected on the page with vendor sources); slide 25 was written for four tools (shown as pending). The owner should correct the deck.
- **B4. Draft scores:** six questions (Q21 to Q26) carry scores derived from the deck heatmap, awaiting SME review. Sigma's score for "critical" presentation quality in Q21 is flagged as likely too high; with it, Tableau and Sigma tie.
- **B5. Weights are provisional** and the confidence thresholds depend on them [A10].
- **B6. Help text:** only two of the 26 "Why we ask" lines exist (Q06 and Q10, from the Flow).
- **B7. Mandatory filters:** only one of the Flow's filter categories is implemented [D14].
- **B8. Three confirmations about the shell** [A1, A2, A4].

## 12. Assumptions register
| # | Assumption | How to confirm |
|---|---|---|
| A1 | The marketplace shell provides the hero, tab row, "On this page", helpfulness row, previous/next and question form, and its stylesheet tokens are available | Ask the marketplace owner |
| A2 | Tabs are separate sub-pages (the previous/next cards suggest it) or anchors; the design works for both | Same |
| A3 | Whether the tab row and right rail stay fixed on scroll is unknown | Same |
| A4 | The marketplace can host a self-contained module made of plain scripts, with no build step | Same |
| A5 | The *Report an issue* form can be pre-filled with the section | Same |
| A6 | Nothing in the marketplace's analytics captures the answers typed on the page | Same; the module itself sends nothing |
| A7 | The Flow does not specify select types for Q14 to Q20; the model uses multi-select for Q14, Q16 to Q20 and single for Q15 | SME review of the six types |
| A8 | The Flow's tie-break "implementation risk and total cost" is read as Q10 to Q12, Q20, Q23 | SME confirmation |
| A9 | Coverage evidence comes from simulated clients answering at random; real clients may differ | Test with real engagements |
| A10 | The confidence thresholds were measured with the provisional weights | Re-run `scripts/calibrate_thresholds.py` after the weighting session |
| A11 | The fit-pill cut-offs (3.5, 2.5, 1.5) | SME confirmation |
| A12 | Consultants are comfortable with a "Details" drawer showing the engine's number | Review with users |
| A13 | The two added "Don't" lines reflect the owner's intent | Owner review |
| A14 | The criterion-to-question mapping behind "Relevant to your answers" (which questions bear on which of the 14 criteria) | SME review |
| A15 | The final summary lists the answers to Q05, Q06, Q20 and Q26 as the client's own constraints | Owner review |
| A16 | The preview shell is only a stand-in: the module needs four page elements (content, rail, "On this page", and a tab row driving `go()`) and the data files, nothing else | Marketplace owner |
| A17 | The one-line guide under each of the 26 questions (it restates the question and makes no claim about any tool) | Owner review |

## 13. Verification log
How this document was checked on 2026-11-17, and what remains unchecked.

| # | Check | Method | Result |
|---|---|---|---|
| 1 | Copy taken from the deck | 40 strings compared with the extracted slide text after normalising typography and UK/US spelling | 19 verbatim; 7 lightly edited (slide 4: "it is" for "it's", "proof of concept" for "POC", "tool or tools" for "tool(s)", "finalised" for "finalized", "again" dropped; slide 16: "the" and "to" added; the slide 4 callout and statement lose their lead-in and tool list); 14 are on slide 3 (row 2). Slide 6's closing phrase was changed on purpose (D5) |
| 2 | Slide 3 | Its text is inside a picture, so it was checked by reading the picture | All card text, the decision node, the footnote and the footer match; one word was missing ("scores" on card 4) and is now added |
| 3 | Slide references | Every slide number is within 1 to 29; the contents slide lists six items | Pass. The criteria count is **14** (slides 7 and 9 hold seven each); an earlier draft said 15 |
| 4 | Flow vs the questions | All 20 Flow questions compared by wording, select type and options | Seven question wordings and one option label differed and were aligned in the workbook; three Flow options are not offered [B1]; one extra option [D16]; types for Q14 to Q20 are not in the Flow [A7] |
| 5 | Question inventory | The appendix is generated from `data/questions.json` and checked on every run of `scripts/check_docs.py` | Pass |
| 6 | Engine facts | Counts and behaviour measured: 26 questions, 22 asked at the start, 9 multi-select, 12 with a not-scored answer, one answer that rules a tool out, scripts 20.2 KB, `result()` 0.03 ms | Pass; the engine's 28 tests and the model harness (37 pass, 6 warn, 0 fail) were re-run |
| 7 | Palette and contrast | Pixels sampled from the five screenshots; WCAG ratios computed | Five of six accents are close to the deck's theme; orchid differs; only indigo and purple pass as text on white; the earlier "meets AA" claim and the pink progress bar were wrong and are replaced |
| 8 | Confidence thresholds | `scripts/calibrate_thresholds.py`: simulated clients, every weight nudged by up to 1 up or down, partial versus final answers | The earlier 0.15 z and 60% were not supported; replaced by 0.3 and 0.5 z and an 80% coverage line, with the evidence quoted in 3.6 |
| 9 | Marketplace claims | Each element compared with the screenshots | Hero, meta, owner chip, tab row, "On this page", helpfulness row, previous/next, question form and pill style are **[Observed]**; fixed-on-scroll, sub-page behaviour, hosting, pre-filling and analytics are not observable [A1 to A6] |
| 10 | Vendor facts in this document | Looker and ThoughtSpot editions checked against vendor documentation (linked in 3.9); Gartner status against vendor pages | Pass for those statements; no other vendor facts are asserted here |
| 11 | Drift protection | `scripts/check_docs.py`: appendix, quoted numbers, links, paths, slide numbers, known-stale figures | Pass |
| 12 | Page tests | `npm test`: 66 tests covering engine parity with Python, bias properties, session behaviour, page logic, the module on preview and production data, accessibility structure and both site builds | Pass |
| 13 | Mutation checks | Six deliberate breakages of the page code, including the scope bug that once hid storage failures | All caught |
| 14 | Browser walk-through | The preview was loaded in the in-app browser: overview; discovery with real clicks; persistence across a reload; shortlist (provisional, narrow lead, ruled-out card, scale); migration; tool details and comparison; final summary; reference; mobile at 375 px | Two bugs found and fixed (a scope bug and the answers panel on mobile); the console is clean; provisional headlines are now hedged |
| 15 | One-page and tile redesign (2026-11-18) | Walk-through in the in-app browser at 1280 px and 375 px: tab row and "On this page" jump to sections and follow the scroll; a real click on a tile keeps the reader's place and saves the answer; the shortlist updates below; tiles drawn as a bar, a grid and "Title / detail" pairs; the console is clean | One defect found and fixed: wide tables stretched the page to 996 px on a phone, now 375 px with no horizontal overflow |
| 16 | Not verified | Printing in a real print dialog; browsers other than the in-app one; screen readers; the marketplace shell; contrast of every rendered state (only the palette pairs were computed) | Open |

**Not verified, by design:** how real clients answer; the marketplace's internals; whether the SMEs agree with the draft scores, weights and proposals; vendor facts beyond those cited; legal and compliance wording.

## 14. The built page
A working preview of the page exists. It follows this document; where the build differs from the earlier draft, section 3 now says so.

**What exists**
| Part | File |
|---|---|
| Content module: all nine sections on one page | `src/page/playbook.js` |
| Page logic: neutral answer order, fit words, lead sentences, summary text | `src/page/lib.js` |
| Styles (measured marketplace colours, contrast-checked pairs) | `src/page/styles.css` |
| Preview shell: stand-in for the marketplace hero, tab row and rail | `src/page/index.html` |
| Scoring engine and questionnaire session | `src/engine/engine.js`, `src/engine/session.js` |
| Deck content as data, extracted by script, not retyped | `scripts/extract_deck_content.py` writes `data/deck/*.json` |
| Site assembly: preview and production builds | `scripts/build_site.py` |

**Run it**
```bash
python scripts/build_site.py                 # preview: draft questions included, with a toggle and reviewer notes
python scripts/build_site.py --production    # draft questions excluded, no reviewer notes
python -m http.server 5173 --directory site  # then open http://localhost:5173
```

**One page, and question tiles (revision 2026-11-18)**
- The nine sections scroll as one page. The tab row stays at the top and marks the section in view; "On this page" lists the nine sections and the five question sections and marks the one in view; both jump to a section, and the web address follows the reader's position.
- A change of answer redraws only the sections that depend on answers (questions, shortlist, migration, tool details, final), not the static ones, and the reader's scroll position does not move (measured: 0 px).
- Questions are tiles in a bar or a grid (3.5). Each question has a numbered header, a "Choose one" or "Choose all that apply" chip, a one-line guide [A17] and a green edge once answered. Each question section has a banner with its progress.
- The "Your answers" panel shows the current lead sentence with a link to the shortlist. On a phone it is a one-line bar under the tab row.
- The notice that answers were cleared stays at the bottom of the window while the reader is among the questions.

**Behaviour added during the build** (each tested)
- While a result is provisional every lead sentence starts with "So far," and the summary says "Best fit so far".
- Reasons show the answer first and the question as context; each heading has a line explaining what it means.
- A ruled-out tool is explained with the deck's own deployment facts for that tool, the question and answer, and the SME rationale.
- The "Your answers" panel is collapsible, starts collapsed on small screens, and keeps its state across updates.
- Hiding draft questions keeps their saved answers, and they return when drafts are shown again.
- Answers and notes are saved in the browser only; Start over clears them.

**Deck content carried onto the page, with its problems visible**
- Tableau's typical features are not shown (the slide repeats Power BI's list).
- Deployment cells for Looker and ThoughtSpot are corrected and marked *Corrected* with the vendor source; every other deck cell is marked as not re-verified.
- The integration table shows text only (its colour markers contradict its legend in 6 cells) and says which tools it does not cover.
- "Why these six tools" is shown as pending.

**What was verified** (section 13, rows 12 to 15) and **what was not**: printing in a real print dialog, browsers other than the in-app one, screen readers, and the marketplace shell.

---

## Appendix: question inventory

Generated from `data/questions.json` by `scripts/check_docs.py --write` (26 questions, in the order they are asked). **[draft]** = scores awaiting review. *(not scored)* = answers that carry no information. *(assumed)* = the select type is not specified by the Flow [A7]. The five-section grouping is this draft's proposal [D2].

<!-- APPENDIX:START -->

**Section 1 Business context and goals**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q01 | What business outcomes are you trying to achieve with BI? | several | Always | Self-service analytics and reporting; Real-time / near-real-time business visibility; Faster, data-driven decision-making; Standardised metrics and a single source of truth; Improved data quality and reporting accuracy; Operational performance monitoring; Improved forecasting and planning; Improved customer / stakeholder reporting; Exit readiness and investor reporting, supporting a credible narrative on performance, scalability and value creation; Other / Not yet defined *(not scored)* |
| Q02 | Who are the primary consumers of the reports/dashboards? | several | Always | C-suite / Executive leadership; Finance; Operational teams and business managers; Sales and commercial teams; Board members / Investors; Private equity / Exit stakeholders; External vendors / Partners; Other / Not yet defined *(not scored)* |
| Q03 | Are delays, low trust in data, inconsistent metrics, or poor access hurting the business? | one | Always | No; Maybe; Yes |
| Q04 | Which enterprise ecosystem do you primarily operate within? | one | Always | Microsoft; Google Cloud; Salesforce; Databricks; Snowflake; Hybrid; None / Not yet defined *(not scored)* |
| Q21 | How important are polished, presentation-quality dashboards and data storytelling? **[draft]** | one | Always | Critical: executive or board-grade bespoke visuals; Important: clean, professional standard dashboards; Not a priority: functional reporting is enough *(not scored)* |
| Q22 | Is AI-assisted or natural-language analytics a priority? **[draft]** | one | Always | AI-first: business users should ask questions in plain English; AI-assisted: useful for report building and Q&A; Not a priority *(not scored)* |
| Q23 | How much does licensing cost drive the decision? **[draft]** | one | Always | Tight budget: cost reduction is the main driver; Balanced: will pay for clear capability; Cost is not the main factor *(not scored)* |
| Q25 | How many people will use the dashboards? **[draft]** | one | Always | 1-10 users *(not scored)*; 11-50 users *(not scored)*; 51-100 users; More than 100 users; To be confirmed *(not scored)* |

**Section 2 Data, security and governance**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q05 | Do you have strict governance or compliance requirements? | one | Always | Yes; No; To be confirmed *(not scored)* |
| Q06 | What are your security and access requirements? | several | Always | Basic access; Role-based access / RLS; Enterprise security (SSO and granular controls); External access; To be confirmed *(not scored)* |
| Q26 | Is a vendor-hosted (SaaS) BI platform acceptable? **[draft]** | one | Always | Yes: vendor-hosted SaaS is acceptable *(not scored)*; No: must run on-premises or on client-controlled infrastructure *(rules out sigma)*; To be confirmed *(not scored)* |
| Q07 | Do you have a defined data model or semantic layer in existing reporting? | one | Always | Yes; Partial; No |
| Q08 | How mature is the current reporting governance process? | one | Always | No formal governance; Partially governed; Fully governed |
| Q09 | Are there any AI governance concerns to be aware of? | one | Always | Yes; Maybe; No |

**Section 3 Skills and change readiness**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q10 | Who will build the reports? | one | Always | JMAN; Client team; Joint delivery |
| Q11 | What is the delivery team's technical skill level (SQL, DAX, modelling)? | one | Only if "Who will build the reports" is "Client team" or "Joint delivery" | Beginner; Intermediate; Advanced |
| Q12 | How much training and change management can the client support? | one | Only if "Who will build the reports" is "Client team" or "Joint delivery" | Full support for upskilling; Can upskill; No training required |
| Q24 | How important is a large talent pool and partner ecosystem for the chosen platform? **[draft]** | one | Always | Critical: must be easy to hire for and to staff; Important: a clear advantage; Not a factor *(not scored)* |

**Section 4 Existing reporting**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q13 | Does the client have an active reporting suite? | one | Always | Yes; Partial / Departmental only; No |
| Q14 | Which BI tools and licences are currently in use? | several (assumed) | Only if "Does the client have an active reporting suite" is "Yes" or "Partial / Departmental only" | Power BI; Looker; Tableau; ThoughtSpot; Sigma; Qlik; Excel / Other |
| Q15 | What is the migration scale? | one (assumed) | Only if "Does the client have an active reporting suite" is "Yes" or "Partial / Departmental only" | Small — up to 25 reports / 200 users; Medium — 26–200 reports / 201–500 users; Large — over 200 reports / over 500 users |

**Section 5 Data landscape and delivery**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q16 | What is the data estate? | several (assumed) | Always | Cloud warehouse ready; Hybrid / on-premises; Fragmented sources / no warehouse; High-volume / rapidly growing |
| Q17 | How complex is the existing content? | several (assumed) | Always | Standard dashboards / simple calculations; Complex calculations / semantic models; Custom visuals / extensions; Write-back / planning / complex dependencies |
| Q18 | What are the refresh and performance requirements? | several (assumed) | Always | Scheduled / daily batch; Near-real-time / live query; High concurrency / strict SLA; Offline / on-premises operation |
| Q19 | Is embedded or external reporting required? | several (assumed) | Always | Internal reporting only; Controlled external sharing; Embedded customer-facing analytics; Pixel-perfect export / scheduled distribution |
| Q20 | What are the migration constraints? | several (assumed) | Always | Aggressive timeline; Limited delivery or change capacity; Risk-minimized parallel run; No material constraints / TBC *(not scored)* |

<!-- APPENDIX:END -->
