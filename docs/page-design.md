# BI Tools Selection Playbook: page design and content draft

Status: known gaps closed 2026-11-18 (D21); audited 2026-11-17 (section 13), built as a preview the same day (section 14) and restructured on 2026-11-18 into pages and on 2026-11-19 into four (section 16, which supersedes sections 3 and 15 where they differ) with a question carousel (section 15, which supersedes the navigation described in section 3). This file is the page in reading order, so it can be reviewed as content first and as design second.

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
> **Superseded in part by sections 15 and 16:** the nine tabs became four pages (Overview, Compare tools, Client discovery, Recommendation) and the questions moved into a carousel.

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

**Revised 2026-11-18** after a review found the page cluttered and its overview repetitive: the deck's flow cards, decision node and "decision inputs" duplicated what the sections themselves say, so they were removed from the page. The deck's content is unchanged in the Purpose, Guiding principles and Migration sections.

- **Lead:** *Choose and justify the right BI tool for a client. Answer questions about the client, see how {the six tools, alphabetical} compare, and copy a summary with the reasons.*
- **Three steps**, each a link that scrolls to its section: *Describe the client* (the discovery questions), *Compare the tools* (the shortlist, the migration effort and each tool in detail), *Write it up* (the summary).
- **Three facts:** *Internal use only. Not for the client to read.* · *Private. Answers and notes stay in this browser.* · *Neutral. The ranking comes only from the answers you give.* **[Deck s4; Engine]**
- **One note:** *If the client already uses a BI tool, the migration section shows how hard the move would be next to how well each tool fits. It does not change the ranking.* **[Proposal, D4; deck s3 footnote paraphrased]**

**Primary button:** Start with the questions.

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
- **Progress:** "7 of 22 questions answered" with a purple bar. 19 are asked at the start; the total moves as branches open or close.
- **State label** (see 3.6).
- **Matters most, still open:** unanswered questions ordered by weight, highest first, each a link to the question. The weights only order the list; they are not shown. Needs a small engine addition **[section 6]**; weights are provisional **[B7]**.
- **Start over**, and a note *Saved on this device.*

### 3.6 Shortlist

**Heading:** Best fit (was *Top 3 shortlist*; see section 16)
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
3. **Fit bar:** how far this tool's fit to your answers is above or below what it would score for a client who told us nothing. Labelled *Weaker*, *Average* and *Stronger* under the bar. The engine's numbers are no longer shown on the card (revision 2026-11-18); they remain available from the engine for consultants **[D15]**.
4. **Why it fits** (up to 3): the client's answer in bold with a fit pill for it (section 2), the question in small type, and the SME rationale for that tool.
5. **Watch-outs** (up to 3), same format. A watch-out can carry a Good fit word: the word is the fit for that answer on its own, while the watch-out is relative to the neutral starting point. One line under the three cards explains this once, instead of under every heading. These are the "risks" the Flow asks for **[D15]**.
6. **Rank note**, only when it applies: *Ranked below {Tool} because {Tool} fits at least as well on every answer you gave.*
> **Data:** `result().shortlist`, `shortlistBoundary`, `leadStrength`, `adjustedByDominance`; `Session.explain(toolId, 3)` returns `strengths` and `concerns`, each with `answer`, `why` and `absoluteFit` **[Engine, tested]**.

**Ruled out by your answers** (only when relevant): a card per excluded tool giving the question, the answer, and the SME's rationale for that tool on that answer. Today **one answer rules a tool out**: "Is a vendor-hosted (SaaS) BI platform acceptable?" answered "No: must run on-premises or on client-controlled infrastructure" rules out Sigma **[Measured: `data/questions.json`]**. The Flow asks for mandatory-constraint filters on security, residency, external access, ecosystem and deployment **[Flow]**; the others are not implemented **[D14]**. So the "every tool ruled out" state in section 4 cannot occur with the current data.

**The other tools** (collapsed): ranks below the shortlist, each with the answer that held it back most: *Held back most by "{answer}" in answer to "{question}"*.

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
| Decision matrix text (14 criteria by 6 tools); the deck's "leads" markers are not shown | Deck slides 7, 9 | Extracted to `data/deck/matrix.json` |
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
- **D20. Dock, quiet countdown, icons.** Requested by the owner on 2026-11-18: the top three became a background-free dock (leader in colour, second 25% grey, third 40% grey), the visible countdown became the progress bar, the countdown fell from 5 to 3.2 seconds, the area-complete card lost its shadow, the popup grew and its neighbours moved outside it, and all arrows and close buttons became line icons (section 15).
- **D19. Pages and a question carousel.** Decided by the owner on 2026-11-18, replacing the one-page scroll [D17]: five pages, a landing page like the Data Engineering Playbook's, questions one at a time in a centred container with arrows, a close button, auto-advance, an area-complete card and a live top three (section 15).
- **D21. Known gaps closed.** Decided by the owner on 2026-11-18: proposed scores for the three missing answers [A21]; Q17 and Q20 follow existing reporting [B2]; the six drafts approved [B4]; weights accepted [B5]; the deck's profiles and tables accepted with the corrections already marked, so the page no longer says they are unverified; the *known gaps* panel removed. Still open: B3 (deck source defects, one of them, the Tableau feature list, withheld on the page), B6 (the one-line guides remain proposed wording [A17]), B7 (one mandatory filter) and B8 (shell confirmations).
- **D18. Double-click clears an answer.** Requested by the owner on 2026-11-18. A double-click on a chosen answer removes it (a single answer becomes unanswered); on a phone, use *Clear*. Because the page redraws after each change, the browser does not report a double-click on a checkbox, so the page reads two changes to the same answer within 450 ms as one. Checked with real mouse events in the in-app browser.
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
- **B1. Closed 2026-11-18.** The three answers that had no scores (Q06 "Data residency requirement", Q12 "Limited upskilling capacity" and "No capacity for change") now have proposed scores and reasons, taken from the deck's data-residency and ease-of-adoption rows, and are offered **[A21]**. They are marked *Proposed* in the workbook's Score basis column for a later expert review.
- **B2. Closed 2026-11-18.** On the owner's decision, Q17 ("How complex is the existing content?") and Q20 ("What are the migration constraints?") are asked only when the client has existing reporting, as follow-ups of Q13 beside Q14 and Q15 **[D21]**. This departs from the Flow, which asks them of everyone.
- **B3. Deck source problems:** the Tableau profile repeats Power BI's typical features (withheld on the page); slide 21's colour markers contradict its legend in 6 cells and it omits two tools (text only is shown); slide 22 says Looker and ThoughtSpot have no on-premises option (corrected on the page with vendor sources); slide 25 was written for four tools (shown as pending). The owner should correct the deck.
- **B4. Closed 2026-11-18.** The owner approved the six questions that were Draft (Q21 to Q26); no question is a draft. Their scores still come from the deck heatmap. Sigma's score for "critical" presentation quality in Q21 was flagged as likely too high; with it, Tableau and Sigma tie, which the page reports as too close to call.
- **B5. Closed 2026-11-18.** The weights are accepted as the current set. The confidence thresholds were measured with them [A10] and must be re-measured if a weight changes.
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
| A23 | The 30 one-line group summaries in the comparison matrix (one for each tool in each of the five groups), the "we" wording of page 1 and its closing call to action | Owner / expert review |
| A22 | The live ranking in the carousel is shown while answering although the recommendation is held back until every question is answered | Owner |
| A21 | The proposed scores for Q06 "Data residency requirement" (3, 2, 4, 2, 3, 4 for Power BI, Looker, Tableau, ThoughtSpot, Sigma, Qlik), Q12 "Limited upskilling capacity" (4, 2, 3, 4, 4, 2) and Q12 "No capacity for change" (3, 1, 3, 3, 4, 2), written from deck slides 7 and 22 | Expert review |
| A17 | The one-line guide under each of the 25 questions (it restates the question and makes no claim about any tool) | Owner review |
| A18 | "About 5 to 10 minutes" is the owner's estimate for the questionnaire; it has not been timed with users | Time a few real sessions |
| A19 | The owner first gave 5 seconds, then 4 and 5 in different places, and on 2026-11-18 asked for 3.2 seconds. 3.2 is used for both the question and the area-complete countdowns, in two constants (`QUESTION_SECONDS`, `SECTION_SECONDS`) | Owner |
| A20 | Tool logos are the files the owner supplied; the Qlik file is a wide wordmark and the Sigma file a black JPEG square, so both look different from the others; whether JMAN may show vendor logos is the owner's decision | Owner |

## 13. Verification log
How this document was checked on 2026-11-17, and what remains unchecked.

| # | Check | Method | Result |
|---|---|---|---|
| 1 | Copy taken from the deck | 40 strings compared with the extracted slide text after normalising typography and UK/US spelling | 19 verbatim; 7 lightly edited (slide 4: "it is" for "it's", "proof of concept" for "POC", "tool or tools" for "tool(s)", "finalised" for "finalized", "again" dropped; slide 16: "the" and "to" added; the slide 4 callout and statement lose their lead-in and tool list); 14 are on slide 3 (row 2). Slide 6's closing phrase was changed on purpose (D5) |
| 2 | Slide 3 | Its text is inside a picture, so it was checked by reading the picture | All card text, the decision node, the footnote and the footer match; one word was missing ("scores" on card 4) and is now added |
| 3 | Slide references | Every slide number is within 1 to 29; the contents slide lists six items | Pass. The criteria count is **14** (slides 7 and 9 hold seven each); an earlier draft said 15 |
| 4 | Flow vs the questions | All 20 Flow questions compared by wording, select type and options | Seven question wordings and one option label differed and were aligned in the workbook; three Flow options are not offered [B1]; one extra option [D16]; types for Q14 to Q20 are not in the Flow [A7] |
| 5 | Question inventory | The appendix is generated from `data/questions.json` and checked on every run of `scripts/check_docs.py` | Pass |
| 6 | Engine facts | Counts and behaviour measured: 25 questions, 19 asked at the start, 9 multi-select, 12 with a not-scored answer, one answer that rules a tool out, scripts 20.2 KB, `result()` 0.03 ms | Pass; the engine's 28 tests and the model harness (37 pass, 6 warn, 0 fail) were re-run |
| 7 | Palette and contrast | Pixels sampled from the five screenshots; WCAG ratios computed | Five of six accents are close to the deck's theme; orchid differs; only indigo and purple pass as text on white; the earlier "meets AA" claim and the pink progress bar were wrong and are replaced |
| 8 | Confidence thresholds | `scripts/calibrate_thresholds.py`: simulated clients, every weight nudged by up to 1 up or down, partial versus final answers | The earlier 0.15 z and 60% were not supported; replaced by 0.3 and 0.5 z and an 80% coverage line, with the evidence quoted in 3.6 |
| 9 | Marketplace claims | Each element compared with the screenshots | Hero, meta, owner chip, tab row, "On this page", helpfulness row, previous/next, question form and pill style are **[Observed]**; fixed-on-scroll, sub-page behaviour, hosting, pre-filling and analytics are not observable [A1 to A6] |
| 10 | Vendor facts in this document | Looker and ThoughtSpot editions checked against vendor documentation (linked in 3.9); Gartner status against vendor pages | Pass for those statements; no other vendor facts are asserted here |
| 11 | Drift protection | `scripts/check_docs.py`: appendix, quoted numbers, links, paths, slide numbers, known-stale figures | Pass |
| 12 | Page tests | `npm test`: 66 tests covering engine parity with Python, bias properties, session behaviour, page logic, the module on preview and production data, accessibility structure and both site builds | Pass |
| 13 | Mutation checks | Six deliberate breakages of the page code, including the scope bug that once hid storage failures | All caught |
| 14 | Browser walk-through | The preview was loaded in the in-app browser: overview; discovery with real clicks; persistence across a reload; shortlist (provisional, narrow lead, ruled-out card, scale); migration; tool details and comparison; final summary; reference; mobile at 375 px | Two bugs found and fixed (a scope bug and the answers panel on mobile); the console is clean; provisional headlines are now hedged |
| 15 | One-page and tile redesign (2026-11-18) | Walk-through in the in-app browser at 1280 px and 375 px: tab row and "On this page" jump to sections and follow the scroll; a real click on a tile keeps the reader's place and saves the answer; the shortlist updates below; tiles drawn as a bar, a grid and "Title / detail" pairs; the console is clean | One defect found and fixed: wide tables stretched the page to 996 px on a phone, now 375 px with no horizontal overflow |
| 16 | Scoring review (2026-11-18) | `python scripts/platform_reach.py` and `python scripts/validate_model.py`: win share and top-three share of every tool for simulated clients by number of requirements stated, before and after the correction; single-answer reach; the deck's scenario for each platform | Correction removes the head start for broad tools (N3b, N3d added); every tool is inside the 10% to 24% band; one deck scenario (presentation-quality dashboards) is now rated too close to call between Tableau and Sigma |
| 17b | Pages and carousel (2026-11-18) | `npm test` (76 tests, including the carousel, follow-ups, countdowns, dock and popup) and a walk-through in the in-app browser at 1280 px and 375 px with real clicks | Passed; one defect found and fixed in the browser: two old preview servers made the browser show an old build |
| 17 | Double-click and redesign check | Real mouse double-clicks on a radio answer and on a checkbox answer in the in-app browser; overview, questions and shortlist viewed | Radio and checkbox clear; the first attempt failed for checkboxes (the browser swallows the double-click after a redraw) and was fixed |
| 18 | Not verified | Printing in a real print dialog; browsers other than the in-app one; screen readers; the marketplace shell; contrast of every rendered state (only the palette pairs were computed) | Open |

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

**Scoring review, declutter and double-click (revision 2026-11-18, second)**
- **Scoring.** A review found that clients who answered many questions kept getting Qlik or Power BI. Cause: on the requirement questions every tool was compared with the neutral score 2, so broadly capable tools earned a premium for each requirement stated. Fixed by centring each tool on its own average requirement premium; the fully-random-client win shares moved from 4% to 33% to 12.8% to 18.9% and the mean score from +0.96 to within 0.02 of zero. `docs/platform-reach.md` has the evidence and shows that every platform can be first. `docs/scoring-method.md` corrects an earlier statement that the drift was not structural.
- **Declutter.** The overview lost its repeated flow cards, decision node and chips. Discovery lost its three step cards, draft banner and per-question fine print; section headers are light rows instead of purple banners; "Add note" is a quiet link. Reviewer-only "Proposed" tags moved from the page to the preview's known-gaps panel. The shortlist lost its explanatory fine print under each heading and its engine numbers.
- **Copy.** Every sentence on the page was re-read for meaning. Vague or clipped text ("A short read.", "Decision inputs", "in answer to ...") was rewritten, and the scoring explanation now matches the corrected method.
- **Double-click** clears an answer [D18].
- **Cache busting.** Every script, style and data URL carries a build hash, so a browser cannot keep showing an older build. During this review two stale preview servers, still listening on port 5173 from earlier sessions, made the browser show an old build; both were stopped.
- **Live scores.** The result is recalculated on every click; the "Your answers" panel shows the current lead sentence. A live ranking of all six tools is deliberately not shown while answering: seeing standings can lead a person to answer toward a preferred tool. Animations are for discussion.

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

**What was verified** (section 13, rows 12 to 17) and **what was not**: printing in a real print dialog, browsers other than the in-app one, screen readers, and the marketplace shell.

---

## 15. Pages and the question carousel (revision 2026-11-18, third)
**This section supersedes how sections 3.1 to 3.11 describe navigation and the question screens.** The content of those sections (wording of the purpose, principles, shortlist, migration, tool details, summary and reference) still applies; where they say "tab" or "section scrolls", read "page" as below. The owner's request: no infinite scroll, a landing page like the Data Engineering Playbook's, questions one at a time in a large centred container.

**Pages** (the tab row; each is its own view)
| Page | Holds |
|---|---|
| Overview | A short purpose line, *Who is this for?*, *How to navigate* and four cards that open the other pages |
| Guidelines | Purpose, guiding principles and *How the recommendation is made* (the scoring explanation moved here from Reference) |
| Compare tools | Tab one: profiles of all six tools (alphabetical, shortlisted ones marked) and the side-by-side comparison. Tab two: deployment, integration and typical scenarios |
| Client discovery | The heading, *a set of questions to find the most suitable BI tool, about 5 to 10 minutes* **[A18]**, the five areas as cards, and *Start the questions* |
| Recommendation | Three tabs: Shortlist, Migration analysis, Final recommendation |

**The five areas, in the order they are asked.** The migration-related questions are last, as requested:
1. Business context and goals (Q01 to Q04, Q21 to Q23, Q25)
2. Data, security and governance (Q05 to Q08, Q26)
3. Skills and change readiness (Q10 with its follow-ups Q11 and Q12, then Q24)
4. Data landscape and delivery (Q16, Q18, Q19)
5. Existing reporting and migration (Q13 with its follow-ups Q14 and Q15, then Q17 and Q20)

Only the page's grouping changed. Which questions are asked, their scores, weights and Show-if rules are as before. Q17 and Q20 are still worded for a migration but asked of every client **[B2]**; they now come last, where they are easiest to skip.

**The carousel.** Opening an area (or *Start the questions*) puts a container over the page: 90% of the window wide (up to 1500 px) and about 80% high on a desktop, exactly centred on the page (the height leaves room for the dock below it), full screen on a phone, with a dimmed and blurred page behind it.
- **Header:** the area title with *Area n of 5*, a close button, and a slim progress bar for the questions in the area.
- **Body:** one question at a time in a centred card, about 84% of the container's width (up to 1140 px), with the answer tiles in even rows: up to three answers side by side, four as a 2 x 2, five or six as three columns, seven or eight as four, nine as three, more as four (`optionColumns`), fading in and out between questions (instant when the reader prefers reduced motion). Answers are the tiles from section 3.5.
- **Controls:** a left and a right arrow and a close button, all drawn as line icons centred in round buttons. Close returns to the Client discovery page with the answers kept. Left and right arrow keys move between questions, except while an answer is focused; Escape closes (or puts the popup away first).
- **Follow-up questions** open **inside the card of the question that triggers them**, below its answers, with a short fade. Today: Q11 and Q12 under Q10 (who builds the reports), and Q14 and Q15 under Q13 (existing reporting). When an answer closes a branch the follow-ups disappear, their answers are cleared and a notice with Undo says so.
- **Burger menu:** a button at the left of the header opens a drawer inside the container listing every area and every question that is asked now, with a tick on answered ones, the current question marked, and open follow-ups indented under their parent. Choosing a question jumps to it (a follow-up jumps to the question that holds it); choosing an area goes to its first question. The drawer closes after a jump, with its close button, by clicking outside it, or with Escape. Opening it cancels a pending auto-advance.
- **Auto-advance:** after a click, if the question (and any follow-up it opened) is answered and nothing is clicked for **3.2 seconds** **[A19]**, the carousel fades to the next question. There is no countdown text and no extra row: the slim progress bar under the area title carries the countdown, a lighter fill running ahead from this question's position to the next one's. An unanswered question never advances by itself; neither does one with an unanswered follow-up. Typing a note or clearing an answer cancels it. There is no "stay" button: any further click restarts the clock, and the arrows move at once.
- **Area complete card:** after the last question of an area, *{Area} is complete*, how many questions were answered and *Next: {area}* appear on the container itself, with no card, border or shadow, so it reads as part of the container. The same progress bar sweeps across for **3.2 seconds** **[A19]**, then moves on; the buttons *Go to the next area* and *Review this area* act at once. After the last area, *All areas are complete* leads to the Recommendation page the same way.
- **The winner:** after the last area, before the Recommendation page opens, the leader's logo flies up from its place in the dock to the middle of the container and grows to a large circle, alone; its name, the lead sentence (hedged with "So far" while the result is provisional) and the buttons fade in after it. The label says *Best fit*, *Best fit so far* or, when tools tie, *Too close to call*, and every co-leader is shown side by side, never a single pick. It stays for **7 seconds** (`WINNER_SECONDS`) with the progress bar sweeping, then the Recommendation page opens; *See the recommendation* does it at once. With no scored answer there is no winner and the plain completion card shows. Reduced-motion readers get no flight.
- **Into the shortlist:** when the carousel closes to open the Recommendation page, each logo on screen (the winner in the middle, the others in the dock) travels to the logo beside that tool's name on its shortlist card, and the card's own logo appears as it lands. The page is not scrolled for it: it opens at the top, a logo flies only if its destination is on screen, and otherwise it fades out. Only this route animates; opening the page from the tab does not. Reduced-motion readers get no flight.
- **Live top three, as a dock:** pinned to the bottom of the screen, centred, like the macOS dock, with no heading and no strip behind it; the container above it leaves room for it. Each tool sits alone in a frosted circle (translucent white with a background blur); the sizes step clearly down by rank (68, 50 and 36 px). The leader's logo is in full colour, the second 25% greyed and the third 40% greyed; all return to full colour on hover and grow slightly, lifting their neighbours a little. The tool's name pops up above on hover. Clicking a circle opens a popup, wider and taller than before, with the rank, logo and name as the heading and a close button; the reasons it fits (and its main watch-outs) scroll inside the card with a slim scrollbar; the previous- and next-ranked tools sit **outside the popup**, at its left and right, each as its logo with an arrow. Tied tools share a size and a rank. Before the first scored answer the dock says so in one line. On a phone the container fills the screen and the dock sits at its bottom edge.

**Logos [A20].** The owner supplied a logo file for every tool in the dumps folder (looker, powerbi, qlik, tableau, Symbol for ThoughtSpot, SigmaComputing). `python scripts/prepare_logos.py` trims the PNGs to small square images in `src/page/assets/logos`; the Sigma JPEG (a black square) is copied as it is and shown with rounded corners. A tool without a file would show a neutral monogram. Section 2's earlier rule of "no logos, one identical card style" was a neutrality measure; the owner has asked for logos, so it is dropped for the dock, the winner and the tool profiles. The dock is also a **live ranking while the reader answers**, which can lead people to answer towards a preferred tool; the owner chose to show it, and the popup says it is provisional.

**Cache.** Every script, style and data URL carries a build hash.

**Verified in the in-app browser:** landing page; Client discovery page; opening the carousel with a real click; a real click on an answer, the countdown, auto-advance to the next question, the live logos, the popup, a follow-up opening inside its parent, the area-complete card; a phone-width layout with no sideways overflow. **Not verified:** other browsers, screen readers, keyboard-only use in a real browser, the marketplace shell.

## 16. Four pages, one best fit, a locked recommendation, a matrix (revision 2026-11-19)
Owner feedback of 2026-11-19, decided in conversation. **This section supersedes the page list and the shortlist, tool-details and comparison descriptions in sections 3 and 15.** **Section 18 supersedes its page list again (two pages, not four), the Compare tools page, the 1 v 1 view and the width notes below.**

**Four pages.** Overview, Compare tools, Client discovery, Recommendation. The Guidelines page no longer exists: its content sits on the Overview page, which reads in this order (revised 2026-11-20): one opening section with the introduction, *Who is this for?* and *When to use it, and when not to* (when to use it, what it helps you decide, what it does not replace, and one note that it is for internal use and that details should be checked before quoting); *How to navigate* (cards for the three other pages, numbered as the tabs are, with the overview as page 1; discovery says *5 areas · 20 to 26 questions*, the range between the questions asked at the start and all of them); then the guidelines under a *Guidelines* label: *Guiding principles*, *What we ask about* and *How the recommendation is made*. A separate *Purpose* section was dropped on 2026-11-20 because it said the same things as *Who is this for?*. **What we ask about** is the playbook's basic criteria: the five areas of questions (business context and goals; data, security and governance; skills and change readiness; data landscape and delivery; existing reporting and migration), each with its one-line description. The word *shortlist* is not used there because the page recommends one tool.

**One best fit.** The shortlist is now called *Best fit*. Under the lead sentence, the lead-strength scale and any note about the edge of the group, the leader gets the one full card (rank, logo, fit bar, why it fits, watch-outs). Every other tool that is not ruled out is a grey logo beside it; hovering shows its name and rank, and clicking swaps the full card to that tool, with a link back to the best fit, so no reasons are hidden. The card always shows exactly one tool, as the owner chose. When tools tie, the card shows the first of them alphabetically with rank *=1* and the lead sentence says they fit equally well and that a proof of concept should separate them; the others stay one click away. The migration analysis and the summary still use the three best-ranked tools.

**The recommendation is locked until every question asked now has an answer** (an answer such as *To be confirmed* counts; skipping does not). Until then the Recommendation page, in all three of its tabs, shows how many questions are open and links to them; the tool profiles stop marking the best fit; and the carousel's last card says how many questions are still open, with a button to the first one, instead of the winner. The live dock in the carousel still shows the provisional top three while answering, as the owner asked earlier **[A22]**. Opening the recommendation by answering everything works as before: the winner appears, then flies to the page.

**Compare tools: a landing, a dictionary and a comparison (revised 2026-11-20).** The page no longer has a row of tabs; it opens on a landing in the style of the overview. The landing has two groups, each a short description and a navigation card: *BI Tools Dictionary* first, then *Compare the tools* with cards for the *Matrix* and the *1 v 1 comparison*. The page is a readable 1100 px wide, centred.
- **BI Tools Dictionary:** one entry per tool, A to Z, each with the tool's logo, best-suited-for line, introduction, typical features, unique features, benefits, AI capabilities, cost tier, deployment (primary, on-premises, data residency, with the vendor-sourced corrections), integration (where the deck covers the tool; otherwise a line says it does not) and the migration note. A row of logo buttons at the top jumps to an entry. The reference tables (scenarios, fast path, deployment and integration tables) follow the entries. This replaces the old *Tool profiles* tab.
- **Matrix and 1 v 1:** each opens under a bar with a way back to the landing and a switch between the two views. The matrix is described below.
- **Matrix:** the six tools as columns (alphabetical, with logos) and the deck's 14 criteria as rows, shown group by group (revised 2026-11-20 because the open table was cluttered). Each group is a closed row that still reads as a row of the matrix: its name, how many criteria it holds, how many are relevant to the client's answers, and under each tool how many of the group's criteria the deck marks that tool as leading (*2 of 3*), with the tool that leads most highlighted and named (*Most leads: Sigma*; a tie highlights and names every tied tool, as in *Tied: Power BI, Qlik and ThoughtSpot*). The count comes from the deck's own lead markers on slides 7 and 9, which are not shown as markers on the criteria themselves. A click opens a group to show its criteria, each cell the deck's short headline; *Expand all groups* and *Collapse all groups* switch them all.
- **1 v 1:** two tools picked from two lists (the same tool cannot be picked twice), every criterion side by side with the full headline and detail, then a Deployment group (primary deployment, on-premises option, data residency control; the vendor-sourced corrections for Looker and ThoughtSpot apply). It opens on the best fit once the recommendation is unlocked.

**Width without the side list (2026-11-20).** A page that has no *On this page* list (the Matrix and 1 v 1 views, the Client discovery and Recommendation pages) no longer keeps the empty side column: the content takes the whole width of the frame, and the Matrix and 1 v 1 views are allowed up to 1440 px. Pages with the list (the Overview, the Compare tools landing and the Dictionary) keep it.

**Disclaimers at the bottom (2026-11-20, shortened later the same day).** The notices are no longer scattered through the pages. Every page ends with one *Notices* block of two short lines, *Internal use only.* and *Check before you quote pricing.*, in regular weight and translucent (55% opacity) rather than bold. The earlier *Private* line (answers and notes stay in this browser) was dropped at the owner's request; the page still keeps answers only in the browser. The matching sentences were removed from the overview, the best-fit page and the preview shell's footer. The printed summary keeps its own *INTERNAL USE ONLY* header, and the notices block is not printed.

**[A22]** Showing a live ranking while the client answers is the owner's choice and can lead people to answer towards a favourite; the recommendation itself is held back until the end.

## 17. The questions in a corner window (revision 2026-11-19, second)
Owner request: when the reader leaves the questions before finishing, the container should shrink into a small window in a corner, like a video pop-up, stay there until the questionnaire is complete, and reopen at any time.

- **Leaving:** closing the container (the close button, Escape or a click outside it) while any question is unanswered animates it shrinking into a corner window at the bottom right of the screen (the backdrop and the dock fade as it goes). With every question answered, closing simply closes it.
- **The corner window:** a small card with a progress ring and the count (*7 of 20 answered*), the area the reader was in, and an expand icon, with a slim progress bar along its bottom edge. It stays on every page, so the reader can read or compare tools meanwhile. It has no dismiss button: it goes only when every question is answered, or on *Start over*.
- **Reopening:** a click grows the container back out of the corner, at the question where it was left (it opens the Client discovery page behind it, as before).
- **After a reload:** a questionnaire that was started but not finished shows its corner window on load.
- **Progress card removed:** the "Your progress" card in the side panel is gone; the corner window replaces it.
- **Motion:** readers who ask for reduced motion get no shrink or grow, only the window appearing and disappearing.

## 18. Two pages, told as a story (revision 2026-11-20, third)
Owner request: the playbook should read as a story, in words that make clear the authors are consultants, and be two pages instead of four. This section supersedes the page list in section 16, the Compare tools landing, the 1 v 1 view and the width paragraph there.

**Section 21 (2026-11-21) rewrites the final recommendation and changes the question set.** **Superseded in part by section 20:** no tab row, the questions are a subpage reached from the last button of page 1, the areas are a card grid, nothing moves on by itself, and the reference section is gone.

**Page 1, Tools overview.** In this order: *Purpose* (we do not start with a favourite; who the playbook is for; when we use it, what it helps us decide, what it does not replace); *Contents* (cards for Do's and Don'ts, Tools dictionary, Comparison matrix, and Client discovery on the next page); *Do's and Don'ts* (the earlier principles, now in the first person: *We start with…*, *We never declare…*); *Tools dictionary*; *Comparison matrix*; a closed *More reference* disclosure (scenarios, fast path, deployment, integration, the pending "why these six" note); and the closing call to action *Still unable to pick a BI tool?* with *Spend just 5 to 10 minutes on a few questions about the client…* and a *Start client discovery* button. The page's own list (*On this page*) follows the same order. It is wider (1200 px) so the matrix fits without sideways scrolling at a normal laptop width.

**Tools dictionary.** One container with a tab for each tool (logo and name, A to Z); the tool chosen is shown in full below the tabs: logo, best-suited-for line, introduction, typical and unique features, benefits, AI capabilities, cost tier, deployment, integration and the migration note, with the same corrections and gaps as before (the Tableau feature list stays withheld). Arrow keys, Home and End move between tabs. The first tool is shown to start with.

**Comparison matrix, and the 1 v 1 view is folded into it.** The Compare tools page and the separate 1 v 1 view are gone: two screens showing the same 14 criteria were a duplication. The matrix now has a *Tools shown* selector, one switch for each tool. All six are on to start with; at least two stay on (the last two cannot be switched off); the columns stay alphabetical. Choosing two tools is the old 1 v 1 comparison. With three tools or fewer each cell also gives the deck's detail line under its headline; with more only the headline is shown. The old Deployment group of the 1 v 1 view is not in the matrix: deployment is on each tool's dictionary tab and in the deployment reference table.
- **Closed group row:** the group name and how many criteria it holds and how many are relevant to the answers (no more *1 of 3* counts). Under each tool is one short line, a summary of that tool's headlines for the group (for example *Fast to adopt, low IT effort*). The lines only restate the deck's headlines and add no claim **[A23]**.
- **Tint:** a cell that leads has a very light teal tint (and a thin teal underline). In a group row it is the tool with the most leading criteria among the tools shown (tools that tie are all tinted; no tint where nobody leads); in a criterion row it is each tool the deck marks as leading. Screen readers hear *Leads this group* or *Leads*. A key above the table shows the tint.
- **Open group:** the criteria appear as children of the group row, with a connector line, a slightly lighter background and smaller type, so it is clear they belong to the row above.

**Page 2, Client discovery.** In this order: the five areas we ask about; *Start the questions* (the button, how long it takes, the tips, including that closing the questions early shrinks them into the corner window, which still stays until every question is answered); then the Recommendation, on the same page, below the questions; then *How the recommendation is made* as a closed disclosure. The Recommendation page of section 16 no longer exists as a page: its three tabs (*Best fit*, *Migration analysis*, *Final recommendation*) sit under the questions, show one best fit as before, and stay locked, with the open questions listed, until every question asked now has an answer. Finishing the questions closes the carousel, scrolls to the recommendation and flies the logos to it, as before.

**Back to top (2026-11-20).** A round button at the bottom right of every page appears once the reader has scrolled about a screen and scrolls smoothly to the top (instantly for readers who ask for reduced motion), then returns keyboard focus to the page. It never sits over the questions: it is hidden while the carousel is open, and when the corner window is showing it rides above that window instead of on top of it. It is not printed.

**Wording and layout pass (2026-11-20, later).** *Purpose* is the two-sentence lead and four labelled rows (who it is for, what it does, when we use it, what it does not replace). The sentence under *Contents* is gone. *Do's and Don'ts* has two cards, *What We Do* and *What We Don't Do*, each item with a round marker: a teal tick for the dos and a red cross for the don'ts. The line under the matrix's tool switches is gone (the one fact worth keeping, that three tools or fewer show the detail, moved into the note under the table). Paragraphs are no longer capped at a character width, which had left the right half of wide containers empty; the dictionary shows the tool's logo and name, a *Best suited for* callout and the introduction across the full panel. *How the recommendation is made* is a bulleted list. Links in the recommendation are purple without an underline. Body text matches the marketplace's own pages (owner screenshot): slate `#334155` (secondary text `#475569`), line height 1.75 in the reading text, headings still indigo. The page font is *M PLUS 1* followed by *M PLUS 1 Fallback*, the site's font: the stylesheet names it first, the marketplace is assumed to load it, and the preview shell loads it from Google Fonts (a stylesheet request to Google in the preview only; `--production` strips it).

**Spacing and alignment pass (2026-11-20, last).** The page now uses one spacing scale: sections 3.5 rem apart, 0.8 rem between a heading and what follows, cards with 1.5 to 1.9 rem of padding and 1.25 rem between them, and more padding in the dictionary panel and the matrix cells. The Contents cards sit two by two instead of four long rows with an empty middle (one column on narrow screens); the five discovery areas are one column so none is left alone on a row; the footer notices share the content's left edge. *Do's and Don'ts* uses plain bullets (no tick or cross on each point); only the two card headings carry an icon, a teal tick and a red cross, and *Don'ts* has its capital D. The Purpose rows had been inheriting an older flex rule for a different element (`.pb-facts`) and drew rows of different lengths; they are now `.pb-purpose`.

**Old links.** The ids of the four-page layout still work: `compare`, `comparehome`, `versus` open page 1 (the dictionary or the matrix), `recommendation`, `shortlist`, `migration` and `final` open page 2 at the recommendation. The preview's address bar rewrites them to the two page ids.

**Removed.** The five areas no longer have their own section on page 1 (they open page 2), *Who is this for?* and *When to use it* are folded into *Purpose*, and the Compare tools landing, the dictionary's A to Z jump buttons, the 1 v 1 pickers and the width rules for the compare views are deleted.

## 19. Content audit (2026-11-20)
Owner request: check that everything the page says is true. Method: every number and rule the page states was checked against the data and the engine; every product name, plan name and capability in the tool profiles was checked against the vendor's own pages or announcements where the vendor site could be read. **This is a point-in-time check: vendors change names, plans and prices often, which is why the page tells readers to check before quoting.**

**Checked against the data and the engine, true:** 6 tools, 14 criteria in 5 groups; 5 areas and 20 questions at the start, up to 26 when both follow-up branches open (checked by opening them); scores run from 1 to 4 with the sheet's own labels; the one rule-out is *Q26, vendor-hosted tool not acceptable* which excludes Sigma; with no answers every tool is tied; the tie-break order is ecosystem, then governance and security, then delivery risk and cost; each area's description matches the questions in it; the matrix's tinted cells are the deck's own "leads" markers.

**Checked against vendor pages, true:** Looker's Gemini and Conversational Analytics, and its two hosting models (Google docs); Power BI's AutoML now lives in Microsoft Fabric (Microsoft retired it from dataflows in 2024; the profile says Fabric); Qlik Predict (AutoML) in the Premium and Enterprise editions and the four tiers Starter, Standard, Premium and Enterprise (Qlik help); Tableau Agent, Tableau Pulse and Tableau+ (Salesforce and Tableau); ThoughtSpot's Spotter; Sigma's Input Tables write-back.

**Found wrong or out of date, and corrected on the page** (each shows a *Corrected* marker with its source): ThoughtSpot's plans are *Essentials, Pro and Enterprise*, not *Team, Pro, Enterprise* (thoughtspot.com/pricing); Sigma's natural-language feature *Ask Sigma* is now part of *Sigma Assistant* (Sigma's own blog, 13 May 2026), in two dictionary lines and one matrix cell. Also corrected: the scoring text said experts scored every answer; in fact the priority questions (Q21 to Q25) were derived from the deck's heatmap and three answers are proposals (A21), all awaiting expert confirmation, and the page now says so. The matrix's one-line summaries now state a limitation as well as a strength where the deck gives one, so they do not read as selective praise.

**Could not be confirmed (left as the deck has it, to be checked by the owner or an expert):**
- Tableau's *Einstein Discovery* for predictions: the integration exists (since 2021, at extra cost) but no source I could read confirms its status or name today.
- Sigma's plan names (*Essential, Business, Enterprise*) and that pricing "scales based on users": third-party sources agree on the names, Sigma's own help describes usage-based credits and older Lite/Essential/Pro tiers, and its pricing page could not be read.
- The name *AI Formula Generator* in Sigma's profile: Sigma's 2024 announcement calls it *Formula Assistant*.
- Tableau's editions and roles and Power BI's licence tiers: tableau.com refused automated reads, and Power BI's tiers were not looked up.
- Every rating in the matrix (for example "Slowest to onboard", "Most turnkey predictive tool") is the deck's judgement, not a checkable fact; it was not re-rated.
- Cost-tier and licensing sentences in all six profiles other than ThoughtSpot's, which change often.

**Still true from earlier:** the Tableau typical-features list is withheld (the deck repeats Power BI's); the integration table covers four tools; the "why these six tools" slide is pending; the one-line question guides are proposed wording (A17); the matrix summaries are proposed wording (A23).

## 20. A single page and a subpage, areas as cards, no timers (revision 2026-11-21)
Owner request. This section supersedes sections 15 and 17 where they describe the countdowns, the "area complete" card and how the questions open, and section 18 where it describes the tab row, the Contents card for client discovery, the reference section and the tips.

**One page and a subpage.** The tab row is gone. Page 1 (Tools overview) is the whole of the playbook proper; *client discovery* is a subpage, reached only from the last button of page 1 (*Start client discovery*). The Contents list no longer has a card for it. The subpage opens with a way back (*Tools overview*). The page address still follows the page (`#/home`, `#/discovery`). The preview strip at the very top of the preview shell is separate and is stripped from the production build.

**Areas as cards.** The five areas are a grid of cards (three across, two on a tablet, one on a phone), each with its number, title, description, how many questions are answered and an action (*Start*, *Continue*, *Review*). The area to do next is outlined and tagged (*Start here*, then *Up next*). The sixth and last card, *Download your answers*, saves the answers and notes as a file. Under the grid is one button: *Start the questions*, *Continue the questions*, or *See the recommendation* when everything is answered. The list of tips under it is gone; the keys are shown inside the questions instead.

**An area opens from its card.** A card grows into the question container; when the area is done the container shrinks back into its card (which now shows a tick), and the card of the next area that has an open question grows in turn. After the last open question the container shows the winner; Enter opens the recommendation, flying the logos there as before. With reduced motion the animations are skipped and the steps happen at once. Closing the questions before they are finished still shrinks them into the corner window.

**The queue of open questions.** *Enter* goes to the next open question in the area, wrapping round to any that were skipped, and finishes the area when none is open. If the only open question is the one on screen, a line says so and Enter stays put. A question with an unanswered follow-up counts as open. The arrow keys, and the arrow buttons, move to the previous or next question in order (past the last one they behave like Enter). The arrow keys work while an answer has focus, which means an answer can no longer be changed with them: use the mouse or Space. While one area is closing into its card and the next is opening, keys do nothing.

**No timers.** The 3.2 second auto-advance, the "area complete" card and its countdown, the sweep drawn in the progress bar and the 7 second winner countdown are all removed. Nothing moves on by itself.

**Review.** An area with every question answered opens as a review: all its questions together, one below the other, answers editable in place, with a *Done* button; Enter closes it unless an answer has focus. If everything is answered, *See the recommendation* goes straight to the recommendation without walking through the questions.

**Removed.** *More reference* (scenarios, fast path, deployment, integration), every "Source: deck, slide…" line and wording that cites the deck, and the tips under the start button. *How the recommendation is made* is rewritten as four short paragraphs in plain sentences, and says that most ratings are expert ratings, that some come from our comparison table and three answers are proposals, and that all of those await confirmation.

**The dictionary is one sentence and a link (2026-11-21).** Each tool tab shows the logo, the name, one sentence (*{Tool} is best suited for …*, the deck's best-suited line with the tool's name spelled out) and a button, *Read the official documentation*, that opens the vendor's own documentation in a new tab: Looker (docs.cloud.google.com/looker/docs), Power BI (learn.microsoft.com/en-us/power-bi), Qlik (help.qlik.com), Sigma (help.sigmacomputing.com), Tableau (help.tableau.com) and ThoughtSpot (docs.thoughtspot.com). All six addresses were opened on 2026-11-21; they are documentation start pages, which change less often than deep links. The long profile (features, benefits, AI, cost tier, deployment, integration, migration note) is no longer shown, and with it the two corrections that lived there (ThoughtSpot's plan names, Sigma's assistant name); the Sigma correction is still applied in the matrix. Deployment facts still appear where a tool is ruled out, and the migration challenges still appear in the migration analysis. The profile data stays in `data/deck/profiles.json`.

**Published page.** `site/` is committed (it is the page hosted from the repository) and is rebuilt with `python scripts/build_site.py --production --with-font`.

## 21. The final recommendation, the save card, and a review of the questions and marks (revision 2026-11-21)
Owner requests, decided on judgement (the long checks were not run again).

**Final recommendation.** It is now a document, not a block of text. Under a title (with the client's name when entered) and a line saying *Internal use only*, the date and the status, it has: the headline (the best fit, with its logo and the lead sentence, or *Too close to call* with every co-leader); *Why it fits* and *Watch-outs*, each point as the answer given, the question it answered and the experts' reason; *The other tools* (ranked, with those ruled out and why); what the client told us they need; migration notes; *Next steps*; and *Answers and notes* by area. The next steps are specific: compare the two when the lead is narrow or tied, go through the watch-outs with the client, list the reports to move when there is a migration, run a proof of concept on the riskiest assumption, check pricing and licensing with the vendor, and, last, a link to the official documentation of the winner (of every co-leader on a tie). The best-fit card ends with the same link. The same content is the Markdown file: *Copy as Markdown*, *Save as Markdown* and *Save as PDF* (the browser's print dialog, with only the document printed) sit under it, and *Back up the answers* (JSON) and *Restore answers* remain.

**The save card.** The last card of the discovery grid is *Save your answers*, with two buttons: *Markdown* (always available) and *PDF* (available once every question is answered, because it holds the recommendation).

**The matrix note is gone.** The paragraph under the matrix explaining the tint was removed; the legend swatch (*Leads*) stays.

**Questions merged or trimmed (workbook edit v6).** 26 questions became 25 and 110 answers became 106: Q09 (*AI governance concerns*) is merged into Q06 as one more requirement (*AI governance concerns*, with the scores of the former *Yes*; its yes/maybe/no ladder duplicated Q05); Q06 *External access* is removed (Q19 asks about external and embedded reporting); Q18 *Offline / on-premises operation* is removed (Q16 and Q26 carry that fact with identical scores). 19 questions are asked at the start (it was 20). The tie-break group *governance* is now Q05 to Q08 and Q26. The Flow sheet's drawing was not edited and still shows the old Q09.

**Marks adjusted by judgement (v6 and v6b), each noted in the workbook's Score basis and awaiting SME confirmation:** Q21 Sigma 4 to 3 (critical) and 3 to 2 (important); Q01 forecasting and planning: Tableau 1 to 2, Sigma 4 to 3; Q16 hybrid and Q26 no-self-hosted: Power BI 4 to 3; Q11 beginner and Q12 no training required: Tableau 4 to 3; Q19 pixel-perfect: Sigma 2 to 3 and Tableau 4 to 3; Q20 parallel run: Looker and ThoughtSpot 2 to 3; Q23 cost: ThoughtSpot 1 to 2 on both answers; Q22 AI: Looker and Sigma 2 to 3 on both answers. A first version of the review also raised Power BI 3 to 4 on Q11 and Q12; it was taken back (v6b) because it made Power BI tie ThoughtSpot and Sigma on every answer in the plain-English and spreadsheet scenarios, and the rule that no tool ranks above one that fits at least as well on every answer then put Power BI first. After the review all six of the deck's client scenarios give the expected tool, including the one that failed before (needs presentation-quality dashboards gives Tableau, with Sigma second).

## 22. Audit of the data, the page and the documents (2026-11-23)
Owner request: check everything once, with complete research on the integrity of the data, and review everything. The checks are now a script, `scripts/check_integrity.py` (`npm run integrity`; `npm run integrity:links` also opens every web address), and a test that fails on any failing check (`tests/integrity.test.js`). It has six parts: **A** the artefacts agree (the workbook converts to `data/questions.json`; the hosted `site/` is built from the current source and data; the parity fixture was made from the current data; the documents state the true counts); **B** the schema (ids, weights, branching, options, marks 1 to 4, one rule-out); **C** the reasons (every answer has a reason for each tool, the tier line of each summary matches the marks, the marks that differ from the deck heatmap carry a recorded reason, the workbook and the JSON hold the same mark for every answer); **D** the deck data (matrix, migration grid, profiles, reference tables, text hygiene); **E** the page's own constants (guides, help, criteria, documentation links); **F** what is tracked in the repository (internal documents, names and e-mail addresses, requests to other sites). At the end of the audit: 42 checks pass, 0 fail, 4 warn (the web-address check adds one more pass and one warning). A warning is a point that needs a person's decision, not a defect.

**Found and fixed.**
- *Data.* The summary of Q22 *AI-assisted* listed three "leaders" although all six tools score 3; it now says, like every other answer where the six tools are alike, that all six fit alike (workbook edit v7, through Excel; no mark changed). The hosted copy of the page was older than the source and was rebuilt. The workbook, opened in Excel, still holds its Flow drawing (24 shapes) and all six threaded comments, with no error cells.
- *Page.* A web address that names a built-in property (`#/constructor`, `#/__proto__`) crashed the page; saved answers were trusted without checking (a removed question or option was dropped silently and stayed on the device, a damaged value became a bogus answer), so saved answers are now checked against the questions, a moved answer is carried over (Q09 *yes* becomes Q06 *AI governance concerns*), and the reader is told what changed; the AI criterion showed *Relevant to your answers* for any answer to the security question; the migration lines covered only the first of two or more tied tools; the Markdown file took notes and the client name raw (a note could add a heading or a list item), so line breaks become spaces and the characters that start emphasis, links, code or HTML are escaped; *Restore answers* accepted any file, kept the earlier client's notes and gave no warning, so it now needs a back-up of this playbook, replaces the notes with the file's own and asks before replacing answers; the on-page and PDF recommendation left out the note about draft questions that the Markdown file has; the document date was the UTC date; the downloads could fail where the browser starts them late; the corner window supplied by a page had no click handler; the start-up error message called every fault a data failure; Back left the site instead of returning to the previous page; stale comments and two unused fields were removed. Eleven new tests cover these.
- *Documents.* The Sigma regions link in `model-validation.md` no longer opened; it now points to Sigma's supported-regions page, which says the cloud chosen when the organisation is created cannot be changed or migrated afterwards. Every web address in the page, the data and the documents was opened: 23 open, 3 refuse automated reads (Microsoft's Fabric blog, Tableau's Gartner page, one journal page) and could not be verified. The README and `engine.md` quoted a test count that had gone stale; they no longer state one.

**Seen in a browser (the built-in one, on the rebuilt `site/`, at a window 800 pixels wide).** The address `#/constructor` now opens the overview with no error; saved answers from the earlier question set were carried over and cleaned, with the notice shown on the first question; Back and Forward move between the two pages; the final recommendation page renders with its date, headline, reasons and watch-outs. **Not seen, only tested:** the animations, the Save as Markdown, Save as PDF and back-up buttons (a file is written or a print dialog opens), a phone-width layout, and a browser other than the built-in one.

**For the owner to decide** (none was changed).
- *The repository is public and holds internal files.* `dumps/` has the internal deck and the workbook as received, and the data workbook has the names and e-mail addresses of the people who wrote and commented on it (F1, F2). Make the repository private or move it into JMAN's organisation, remove `dumps/`, and scrub the history, before anything more is pushed. Three commits (the discovery subpage, the dictionary and the review of the marks) are not pushed, so the hosted page is older than this one.
- *The font.* The hosted page asks Google Fonts for its font, which tells Google the visitor's address (F3). The marketplace's own font would remove the request.
- *Marks and weights.* Twelve answers still wait for an expert to confirm them (nine taken from the deck heatmap and marked *DRAFT: SME to confirm*, three proposed: Q06 *Data residency requirement*, Q12 *Limited upskilling capacity* and *No capacity for change*); the weights were never elicited (changing every weight by 1 changes the top three for 29% of clients); two pairs of answers carry identical marks and so count one fact twice (Q05 *yes* and Q06 *AI governance concerns*; Q11 *beginner* and Q12 *no training required*).
- *Facts still unconfirmed.* Whether Tableau's Einstein Discovery is still offered under that name (a second search found no Tableau page that says; Salesforce's renaming of *Tableau Einstein* to *Tableau Next* suggests the name has moved), the names of Sigma's plans (listings now disagree: *Essentials, Professional, Enterprise* in one, *View, Act, Analyze, Build* licence tiers in another; the deck's *Essential, Business, Enterprise* is not on the page), and Tableau's editions.
- *The Flow sheet.* Its drawing still shows the old Q09, Q06 *External access* and Q18 *Offline*.

## 23. The area-complete card (revision 2026-11-23)
Owner report: when an area was finished the container vanished at once. **Now** the last answered question is followed by a card in the same container: a tick, *Area N complete*, *All X questions in "title" answered*, and *Next: title* (the next area that has an open question). After 1.7 seconds the card fades out and the next area fades in, in the same container; Enter moves on sooner (ignored for the first half second, so a held-down Enter does not skip the message). Closing during the message shrinks the questions into the corner window as for any unfinished questions. The section 20 description of the container shrinking into its card no longer applies to finishing an area (an area still grows out of its card when it is opened from the page). After the last area the winner is shown as before. This is the only wait in the questions: it is a short transition, and no question advances by itself. With reduced motion the message shows, then the next area appears without the fade.

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
| Q21 | How important are polished, presentation-quality dashboards and data storytelling? | one | Always | Critical: executive or board-grade bespoke visuals; Important: clean, professional standard dashboards; Not a priority: functional reporting is enough *(not scored)* |
| Q22 | Is AI-assisted or natural-language analytics a priority? | one | Always | AI-first: business users should ask questions in plain English; AI-assisted: useful for report building and Q&A; Not a priority *(not scored)* |
| Q23 | How much does licensing cost drive the decision? | one | Always | Tight budget: cost reduction is the main driver; Balanced: will pay for clear capability; Cost is not the main factor *(not scored)* |
| Q25 | How many people will use the dashboards? | one | Always | 1-10 users *(not scored)*; 11-50 users *(not scored)*; 51-100 users; More than 100 users; To be confirmed *(not scored)* |

**Section 2 Data, security and governance**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q05 | Do you have strict governance or compliance requirements? | one | Always | Yes; No; To be confirmed *(not scored)* |
| Q06 | What are your security and access requirements? | several | Always | Basic access; Role-based access / RLS; Enterprise security (SSO and granular controls); Data residency requirement; AI governance concerns (control over how AI features use the data); To be confirmed *(not scored)* |
| Q26 | Is a vendor-hosted (SaaS) BI platform acceptable? | one | Always | Yes: vendor-hosted SaaS is acceptable *(not scored)*; No: must run on-premises or on client-controlled infrastructure *(rules out sigma)*; To be confirmed *(not scored)* |
| Q07 | Do you have a defined data model or semantic layer in existing reporting? | one | Always | Yes; Partial; No |
| Q08 | How mature is the current reporting governance process? | one | Always | No formal governance; Partially governed; Fully governed |

**Section 3 Skills and change readiness**

| # | Question | Select | Asked | Options |
|---|---|---|---|---|
| Q10 | Who will build the reports? | one | Always | JMAN; Client team; Joint delivery |
| Q11 | What is the delivery team's technical skill level (SQL, DAX, modelling)? | one | Only if "Who will build the reports" is "Client team" or "Joint delivery" | Beginner; Intermediate; Advanced |
| Q12 | How much training and change management can the client support? | one | Only if "Who will build the reports" is "Client team" or "Joint delivery" | Full support for upskilling; Limited upskilling capacity; Can upskill; No training required; No capacity for change |
| Q24 | How important is a large talent pool and partner ecosystem for the chosen platform? | one | Always | Critical: must be easy to hire for and to staff; Important: a clear advantage; Not a factor *(not scored)* |

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
| Q17 | How complex is the existing content? | several (assumed) | Only if "Does the client have an active reporting suite" is "Yes" or "Partial / Departmental only" | Standard dashboards / simple calculations; Complex calculations / semantic models; Custom visuals / extensions; Write-back / planning / complex dependencies |
| Q18 | What are the refresh and performance requirements? | several (assumed) | Always | Scheduled / daily batch; Near-real-time / live query; High concurrency / strict SLA |
| Q19 | Is embedded or external reporting required? | several (assumed) | Always | Internal reporting only; Controlled external sharing; Embedded customer-facing analytics; Pixel-perfect export / scheduled distribution |
| Q20 | What are the migration constraints? | several (assumed) | Only if "Does the client have an active reporting suite" is "Yes" or "Partial / Departmental only" | Aggressive timeline; Limited delivery or change capacity; Risk-minimized parallel run; No material constraints / TBC *(not scored)* |

<!-- APPENDIX:END -->
