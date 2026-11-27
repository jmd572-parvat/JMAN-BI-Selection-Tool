# JMAN BI Selection Tool

A playbook page that helps choose and justify a BI tool (Looker, Power BI, Qlik, Sigma, Tableau, ThoughtSpot) for a client engagement. It is built to be dropped into the company marketplace.

The recommendation comes only from the client's answers. No platform is favoured: scores are compared against a neutral starting point, tool order never matters, and ties are shown as ties. See `docs/scoring-method.md`.

For the marketplace team taking this over, start with `docs/handoff.md`.

## Where things are
| Path | What |
|---|---|
| `data/bi-tools-questions.xlsx` | Working copy of the questions, options, weights and expert scores (edit it in Excel only, never rewrite it with a library, so the Flow drawing and comments survive) |
| `data/questions.json` | Built from the workbook by `scripts/excel_to_json.py` |
| `data/deck/*.json` | Deck content (profiles, matrix, migration, reference) extracted by `scripts/extract_deck_content.py` |
| `src/engine/` | Scoring engine and questionnaire session (plain JavaScript, no dependencies) |
| `src/page/` | The page: content module, page logic, styles, preview shell |
| `scripts/` | Converters, the Python reference engine, validation, calibration, site build, docs check |
| `tests/` | `node --test` suite |
| `docs/` | Design, scoring method, engine, validation, workshop and open items |

## Commands
```bash
python scripts/build_site.py                 # preview build into site/ (draft questions included, with a toggle)
python scripts/build_site.py --production    # production build: draft questions and reviewer notes removed
python -m http.server 5173 --directory site  # then open http://localhost:5173
npm test                                     # all tests
python scripts/validate_model.py             # model checks (neutrality, scenarios, branching)
python scripts/check_docs.py                 # keep the docs tied to the data and code
python scripts/check_integrity.py            # workbook, JSON, hosted page, fixtures, deck data and tracked files agree (add --links to open every web address)
python scripts/calibrate_thresholds.py       # re-derive confidence thresholds after any weight change
python scripts/platform_reach.py             # how often each platform is recommended (docs/platform-reach.md)
python scripts/prepare_logos.py <folder>     # tool logos from the original files into src/page/assets/logos
```

After changing the workbook: `python scripts/excel_to_json.py`, then `npm run parity:update`, then the checks above.

## Status
A working preview exists. It is not ready to ship: the weights have not been set in a workshop, and the marketplace shell is stood in for. The open items are in `docs/page-design.md`, sections 11, 12 and 22, and in `docs/handoff.md`.
