# Handover note for the marketplace team

This repository is the BI Tools Selection Playbook: a page that recommends one of six BI tools (Looker, Power BI, Qlik, Sigma, Tableau, ThoughtSpot) from a client's answers. It is plain HTML, CSS and JavaScript with no dependencies. This note says what is here, where each piece lives, what is safe to rewrite (the written content) and what must not be rewritten (the scoring and the questionnaire logic).

## 1. Run it in two minutes
```
python scripts/build_site.py --production --with-font   # builds site/ (drop --with-font if the marketplace supplies the font M PLUS 1)
python -m http.server 5173 --directory site             # open http://localhost:5173
npm test                                                # all tests, no install needed (Node 18 or later)
python scripts/check_integrity.py                       # the data, the built page and the documents agree
```
`site/` is the built page and is committed. Rebuild it after any change to `src/`, `data/` or the deck data.

## 2. What the page is
Two views, reached by the address `#/home` and `#/discovery`:

| View | Contents |
|---|---|
| Tools overview (`home`) | Purpose, contents, do's and don'ts, tools dictionary (a one-line summary and a link to each tool's own documentation), comparison matrix, the button into discovery |
| Client discovery (`discovery`) | The five question areas as cards, the questionnaire (a window that shows one question at a time), the recommendation (best fit, migration, final document), "How the recommendation is made" |

The recommendation opens only when every question asked has an answer. Answers and notes are kept in the visitor's browser (`localStorage`, key `bi-playbook-v1`) and never leave the device. The client name typed on the final document is never stored.

## 3. Where each thing lives

**Written content (the part you are likely to convert)**

| Content | Where |
|---|---|
| Page text: purpose, contents, do's and don'ts, call to action, discovery intro, locked-recommendation and migration notes, final-document headings and next steps | Strings inside the `render…` functions of `src/page/playbook.js` (`renderOverview`, `renderNavigate`, `renderPrinciples`, `renderCta`, `renderDiscovery`, `renderDictionary`, `renderMatrix`, `renderShortlist`, `renderMigration`, `renderFinal`, `finalHtml`, `summaryContext`) |
| "How the recommendation is made" | `scoringHtml()` in `src/page/playbook.js` |
| Area titles and blurbs | `SECTIONS` in `src/page/playbook.js` |
| One-line guide under each question | `GUIDE` (and `HELP`) in `src/page/playbook.js` |
| Matrix group summaries | `GROUP_SUMMARY` in `src/page/playbook.js` |
| Lead sentence, boundary note, status line, Markdown export | `src/page/lib.js` (`leadSentence`, `boundaryMessage`, `stateLine`, `buildSummary`) |
| Documentation links for each tool | `DOCS` in `src/page/playbook.js` (every address was opened on 2026-11-21) |
| Questions, answers, weights, marks and the per-tool reasons | `data/bi-tools-questions.xlsx`, built into `data/questions.json` by `scripts/excel_to_json.py` |
| Tool profiles, matrix cells, migration ratings and challenges, reference tables | `data/deck/*.json` (from JMAN's comparison deck) |
| Look and layout | `src/page/styles.css`; logos in `src/page/assets/logos` |
| The preview header, "Ask a question" stand-in, and the hash routing | `src/page/index.html` (a stand-in shell; the marketplace provides the real hero, "On this page" and feedback) |

**Logic (do not rewrite as content)**

| What | Where |
|---|---|
| Scoring: branching, ranking, ties, rule-outs, confidence | `src/engine/engine.js`, a line-for-line match of `scripts/bi_model.py` |
| Questionnaire session: answers, branches, progress, results | `src/engine/session.js` |
| The two engines must agree | `tests/fixtures/parity.json`, made by `scripts/make_parity_fixtures.py`; `tests/parity.test.js` fails if they differ |

If you move the written content into MDX, keep the logic as it is and embed it, for example as components that call `Playbook.mount(...)`. The page module takes these options: `container` (required), `rail`, `toc`, `overlay`, `mini`, `model` (the contents of `data/questions.json`), `deck` (`{ profiles, matrix, migration, reference }` from `data/deck`), `config` (`storageKey`, `showDrafts`, `lockUntilComplete`, `logos`) and `onTab` (called with `home` or `discovery`). `index.html` shows a complete example of calling it.

## 4. Rules the content must keep
These are tested; see `docs/scoring-method.md` and the top of `src/page/playbook.js`.
- The recommendation comes only from the client's answers. No tool is favoured, and the order of tools never matters.
- Tied tools are shown as tied, never as a single winner.
- Static lists of tools are alphabetical.
- A fit word beside an answer ("Strong fit" and so on) is supporting evidence only; it never sets the rank.
- Copy must not strengthen claims.

## 5. Editing the questions and marks
- Edit `data/bi-tools-questions.xlsx` **in Excel only**. A library that rewrites the file would drop its Flow drawing and comments.
- After any edit: run `python scripts/_strip_workbook_names.py data/bi-tools-questions.xlsx` (Excel puts the editor's name back into the file), then `python scripts/excel_to_json.py`, `npm run parity:update`, `python scripts/build_site.py --production --with-font`, then the checks in section 1.
- The production build leaves out draft questions and the reviewer notes (`--exclude-draft --no-score-basis`), so only approved content and no review notes are published.

## 6. Known open items
- The marks have been approved by the experts. The notes in the workbook's Score basis column record where each came from (the deck heatmap, the owner's review, or a proposal).
- The weights have not been agreed in a workshop. Changing every weight by 1 changes the top three for about 29% of clients (`docs/score-audit.md`).
- These vendor facts are unconfirmed: whether Tableau's Einstein Discovery is still offered under that name, Sigma's plan names, and Tableau's editions (`docs/page-design.md`, sections 19 and 22).
- The page asks Google Fonts for its font when built with `--with-font`. Build without it if the marketplace already loads M PLUS 1.
- The "v1 draft", date and owner line in `index.html` stands in for the marketplace's own header.

## 7. More detail
`docs/page-design.md` (design decisions and revisions), `docs/scoring-method.md` (how scores become a recommendation), `docs/engine.md` (the JavaScript engine), `docs/model-validation.md` and `docs/score-audit.md` (checks on the scoring), `README.md` (commands).
