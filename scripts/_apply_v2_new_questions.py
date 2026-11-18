"""
One-off workbook migration v2 (validation report recommendations R2, R3, R7):

  * new columns: Order (asking sequence), Status (approved|draft), Score basis (provenance),
    Combined (legacy) (SME's original combined rationale, preserved)
  * six DRAFT questions: Q21 visual/storytelling need, Q22 AI/natural-language appetite,
    Q23 cost driver, Q24 talent/partner pool, Q25 user count, Q26 vendor-hosted SaaS acceptable
  * Q20 options 'Tight budget' and 'On-premises / residency constraint' MOVE (scores and rationales
    unchanged) to Q23 / Q26, removing a double count; Q26 'No' also carries Excludes=sigma
  * 'Combined Final Rationale' regenerated for every option from the sheet's own scores and per-tool
    rationales: no quoted numbers (so it can never go stale) and all six tools are named

Every new score is derived from the deck heatmap (slide 8) with ONE documented rule:
    1-5 heatmap -> 1-4 score:  5->4, 4->3, 3->2, 2->1, 1->1
    'Important'/'Balanced' variants compress the top: 4->3 (others unchanged)
    neutral answers score 2 for all tools and are flagged Unknown (ignored in scoring)
Edits go through Excel (win32com) so Flow shapes, threaded comments and review tasks survive.
Run once on a fresh copy. Usage: python scripts/_apply_v2_new_questions.py data/bi-tools-questions.xlsx
"""
import os
import sys

import win32com.client as win32

DECK = ["powerbi", "tableau", "looker", "thoughtspot", "qlik", "sigma"]            # heatmap column order
MODEL = ["powerbi", "looker", "tableau", "thoughtspot", "sigma", "qlik"]           # sheet column order
NAMES = {"powerbi": "Power BI", "looker": "Looker", "tableau": "Tableau", "thoughtspot": "ThoughtSpot",
         "sigma": "Sigma", "qlik": "Qlik"}
HEAT = {"viz": (3, 5, 3, 2, 3, 5), "ai": (5, 4, 3, 5, 4, 3), "tco": (5, 3, 3, 2, 4, 4),
        "community": (5, 4, 3, 3, 4, 2), "scale": (3, 3, 5, 4, 4, 4)}
HEAT_NAME = {"viz": "Visualization & Storytelling", "ai": "AI-Assisted & Conversational",
             "tco": "Licensing & TCO", "community": "Community & Partner Support", "scale": "Scalability & Performance"}
HEAT_SLIDE = {"viz": 7, "ai": 7, "tco": 9, "community": 9, "scale": 9}
M54 = {5: 4, 4: 3, 3: 2, 2: 1, 1: 1}
# deck matrix wording (slides 7 and 9), used as the per-tool rationale
TEXT = {
    "viz": {"powerbi": "Needs DAX to customize visuals; pairs best with a skilled team.",
            "tableau": "Most flexible visuals; best with a dedicated analyst team.",
            "looker": "Less flexible than Tableau; visual changes route through LookML.",
            "thoughtspot": "Built for exploration; not polished storytelling.",
            "qlik": "Strong but less flexible than Tableau; moderate skill needed.",
            "sigma": "Easiest to self-edit; spreadsheet-style with fast iteration."},
    "ai": {"powerbi": "Most integrated AI: Copilot gives natural-language Q&A and DAX help.",
           "tableau": "Strong AI support: Tableau Agent builds from a prompt.",
           "looker": "Narrower AI scope: Gemini is grounded in governed LookML.",
           "thoughtspot": "AI is the core product: Spotter offers the deepest search of the six.",
           "qlik": "Solid AI support: Qlik Answers is grounded in your data.",
           "sigma": "Lighter AI support: Ask Sigma covers the basics."},
    "tco": {"powerbi": "Lowest entry cost; best TCO inside Microsoft estates.",
            "tableau": "Premium pricing, justified for advanced analytics.",
            "looker": "Enterprise-only pricing; best value if already on Google Cloud.",
            "thoughtspot": "Premium, AI-focused pricing: you pay for the search-first experience.",
            "qlik": "Flexible licensing that scales cost with usage.",
            "sigma": "Minimal infrastructure overhead; no separate BI server to run."},
    "community": {"powerbi": "Largest talent pool; easiest to staff and support.",
                  "tableau": "Mature global community with strong enterprise partner support.",
                  "looker": "Smaller talent pool, tied to the Google Cloud ecosystem.",
                  "thoughtspot": "Smaller, growing community; fewer implementation partners available.",
                  "qlik": "Established global ecosystem with a solid enterprise support network.",
                  "sigma": "Newest and smallest talent pool, in a rapidly growing ecosystem."},
    "scale": {"powerbi": "Capped by Fabric limits; scales within your capacity tier.",
              "tableau": "Scales with investment; flexible performance architecture.",
              "looker": "Scales with your warehouse; no caching layer to manage.",
              "thoughtspot": "Built for high concurrency; optimised for cloud warehouses.",
              "qlik": "Enterprise-grade scaling; hybrid and multi-cloud ready.",
              "sigma": "Elastic and warehouse-native; scales automatically with usage."},
}
NEUTRAL_TEXT = "This answer does not favour any platform."
NEUTRAL_BASIS = "Neutral: this answer expresses no preference between platforms (all 2, flagged Unknown)."


def heat_scores(key):
    return {t: M54[v] for t, v in zip(DECK, HEAT[key])}


def compress(sc):
    return {t: (3 if v == 4 else v) for t, v in sc.items()}


def mean_round(a, b):
    return {t: int((a[t] + b[t]) / 2 + 0.5) for t in a}


def basis(key, how="full row"):
    return (f"Deck heatmap (slide 8), row '{HEAT_NAME[key]}' (matrix text slide {HEAT_SLIDE[key]}); "
            f"{how}; rule 5->4, 4->3, 3->2, 2->1, 1->1. DRAFT: SME to confirm.")


def heat_opt(oid, label, key, scores=None, how="full row"):
    return dict(id=oid, label=label, scores=scores or heat_scores(key), unknown=False, excludes="",
                basis=basis(key, how), tools=dict(TEXT[key]))


def neutral_opt(oid, label, why=None):
    return dict(id=oid, label=label, scores={t: 2 for t in MODEL}, unknown=True, excludes="",
                basis=why or NEUTRAL_BASIS, tools={t: NEUTRAL_TEXT for t in MODEL})


SMALL_WHY = ("Neutral by design: with a small user base scale is not a differentiator, and licensing cost is already "
             "captured by Q23 (avoids counting one cost fact twice). All 2, flagged Unknown.")
NEW = {  # qid -> spec.  moved options (from Q20) are filled in at run time
    "Q24": dict(section=3, local="3", order=18, weight=1, type="single",
                text="How important is a large talent pool and partner ecosystem for the chosen platform?",
                options=[heat_opt("critical", "Critical: must be easy to hire for and to staff", "community"),
                         heat_opt("important", "Important: a clear advantage", "community", compress(heat_scores("community")),
                                  "full row compressed one step (4->3)"),
                         neutral_opt("not_a_factor", "Not a factor")]),
    "Q26": dict(section=2, local="6", order=11, weight=3, type="single",
                text="Is a vendor-hosted (SaaS) BI platform acceptable?",
                options=[neutral_opt("yes", "Yes: vendor-hosted SaaS is acceptable"),
                         "MOVE:on_premises_residency_constraint",
                         neutral_opt("tbc", "To be confirmed")]),
    "Q21": dict(section=1, local="5", order=5, weight=2, type="single",
                text="How important are polished, presentation-quality dashboards and data storytelling?",
                options=[heat_opt("critical", "Critical: executive or board-grade bespoke visuals", "viz"),
                         heat_opt("important", "Important: clean, professional standard dashboards", "viz",
                                  compress(heat_scores("viz")), "full row compressed one step (4->3)"),
                         neutral_opt("not_a_priority", "Not a priority: functional reporting is enough")]),
    "Q22": dict(section=1, local="6", order=6, weight=2, type="single",
                text="Is AI-assisted or natural-language analytics a priority?",
                options=[heat_opt("ai_first", "AI-first: business users should ask questions in plain English", "ai"),
                         heat_opt("ai_assisted", "AI-assisted: useful for report building and Q&A", "ai",
                                  compress(heat_scores("ai")), "full row compressed one step (4->3)"),
                         neutral_opt("not_a_priority", "Not a priority")]),
    "Q23": dict(section=1, local="7", order=7, weight=3, type="single",
                text="How much does licensing cost drive the decision?",
                options=["MOVE:tight_budget",
                         heat_opt("balanced", "Balanced: will pay for clear capability", "tco",
                                  compress(heat_scores("tco")), "full row compressed one step (4->3)"),
                         neutral_opt("not_main_factor", "Cost is not the main factor")]),
    "Q25": dict(section=1, local="8", order=8, weight=1, type="single",
                text="How many people will use the dashboards?",
                options=[neutral_opt("u_1_10", "1-10 users", SMALL_WHY),
                         neutral_opt("u_11_50", "11-50 users", SMALL_WHY),
                         heat_opt("u_51_100", "51-100 users", "scale", compress(heat_scores("scale")),
                                  "'Scalability & Performance' row compressed one step (4->3)"),
                         heat_opt("u_100_plus", "More than 100 users", "scale", None,
                                  "large user base: 'Scalability & Performance' row"),
                         neutral_opt("tbc", "To be confirmed")]),
}
for _o in NEW["Q21"]["options"]:
    if not _o["unknown"]:
        _o["basis"] += (" CAUTION: Sigma's 4 reflects 'easiest to self-edit', not bespoke presentation quality; "
                        "SME to confirm.")
# asking order for every question (display sequence; Q IDs stay stable)
ORDER = {"Q01": 1, "Q02": 2, "Q03": 3, "Q04": 4, "Q21": 5, "Q22": 6, "Q23": 7, "Q25": 8, "Q05": 9, "Q06": 10,
         "Q26": 11, "Q07": 12, "Q08": 13, "Q09": 14, "Q10": 15, "Q11": 16, "Q12": 17, "Q24": 18, "Q13": 19,
         "Q14": 20, "Q15": 21, "Q16": 22, "Q17": 23, "Q18": 24, "Q19": 25, "Q20": 26}
TIER = {4: "Strong fit", 3: "Good fit", 2: "Suitable", 1: "Possible but not ideal"}   # sheet legend wording
BGR = lambda h: int(h[4:6] + h[2:4] + h[0:2], 16)


def combined_text(unknown, scores, texts):
    if unknown:
        return "This answer does not favour any platform; it is recorded but not scored."
    top = max(scores.values())
    leaders = [t for t in DECK if scores[t] == top]
    if len(set(scores.values())) == 1:
        return "All six platforms fit this answer alike, so it does not change the ranking."
    parts = []
    for s in (4, 3, 2, 1):
        ts = [NAMES[t] for t in DECK if scores[t] == s]
        if ts:
            parts.append(f"{TIER[s]}: {', '.join(ts)}.")
    why = " ".join(f"{NAMES[t]}: {texts[t].rstrip('.')}." for t in leaders[:3])
    more = f" (and {len(leaders) - 3} more)" if len(leaders) > 3 else ""
    return " ".join(parts) + " Why the leaders" + more + ": " + why


def main(path):
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")

        def hmap():
            return {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 45) if ws.Cells(5, c).Value2}
        H = hmap()
        assert "Order" not in H, "already migrated"
        lav = BGR("E9E4FA")

        def add_cols(at, names, widths):
            ws.Range(ws.Columns(at), ws.Columns(at + len(names) - 1)).Insert(Shift=-4161, CopyOrigin=1)
            for i, (n, w) in enumerate(zip(names, widths)):
                c = ws.Cells(5, at + i)
                c.Value2 = n
                c.Interior.Color = lav
                c.Font.Bold = True
                ws.Columns(at + i).ColumnWidth = w
        # ---- phase 1: columns
        add_cols(H["Options"], ["Order", "Status"], [7, 10])
        H = hmap()
        add_cols(H["Unknown"] + 1, ["Score basis"], [46])
        H = hmap()
        add_cols(H["Combined Final Rationale"] + 1, ["Combined (legacy)"], [50])
        H = hmap()
        OPT, OID, EXC, UNK, BAS = H["Options"], H["Option ID"], H["Excludes"], H["Unknown"], H["Score basis"]
        SC = [H[NAMES[t]] for t in MODEL]
        RAT = [H[NAMES[t] + " Rationale"] for t in MODEL]
        COMB, LEG = H["Combined Final Rationale"], H["Combined (legacy)"]
        QID, TYPE, WGT, SHOW, STG, ORD, STA = (H[k] for k in ("Q ID", "Type", "Weight", "Show if", "Stage", "Order", "Status"))
        QTXT, NUM = H["Question"], H["#"]
        last_col = RAT[-1]

        def find_rows(col, value):
            return [r for r in range(6, 200) if str(ws.Cells(r, col).Value2).strip() == value]

        def block_end(first):
            """Last option row of the question that starts at `first`. Blocks are contiguous, so stop at the
            next row that carries a Q ID (merged cells read as empty below the first row of a block)."""
            r = first
            while ws.Cells(r + 1, OID).Value2 and not ws.Cells(r + 1, QID).Value2:
                r += 1
            return r

        # ---- phase 2: Order/Status for existing questions (+ merge like other question-level columns)
        for q, order in ORDER.items():
            if q in NEW:
                continue
            first = find_rows(QID, q)[0]
            end = block_end(first)
            ws.Cells(first, ORD).Value2 = order
            ws.Cells(first, STA).Value2 = "approved"
            for c in (ORD, STA):
                rng = ws.Range(ws.Cells(first, c), ws.Cells(end, c))
                rng.Merge()
                rng.VerticalAlignment = -4108
                rng.HorizontalAlignment = -4108
        # legacy combined: preserve every SME combined rationale before regeneration
        opt_rows = [r for r in range(6, 200) if ws.Cells(r, OID).Value2]
        for r in opt_rows:
            ws.Cells(r, LEG).Value2 = ws.Cells(r, COMB).Value2
            ws.Cells(r, LEG).Font.Italic = True
            ws.Cells(r, LEG).Font.Color = BGR("7A7A8C")

        # ---- capture the Q20 options that move (scores, per-tool rationale, legacy text)
        moved = {}
        for oid in ("tight_budget", "on_premises_residency_constraint"):
            r = find_rows(OID, oid)
            assert len(r) == 1, oid
            r = r[0]
            moved[oid] = dict(row=r, scores={t: int(ws.Cells(r, c).Value2) for t, c in zip(MODEL, SC)},
                              tools={t: str(ws.Cells(r, c).Value2) for t, c in zip(MODEL, RAT)},
                              legacy=ws.Cells(r, LEG).Value2, general=ws.Cells(r, H["Rationale"]).Value2)
        moved["tight_budget"].update(label="Tight budget: cost reduction is the main driver", id="tight_budget", excludes="",
                                     unknown=False, basis="Moved unchanged from Q20 'Tight budget' (SME-scored; no score or rationale change). "
                                     "Matches deck heatmap row 'Licensing & TCO' except Looker 1 vs 2.")
        moved["on_premises_residency_constraint"].update(
            label="No: must run on-premises or on client-controlled infrastructure", id="no_self_hosted",
            excludes="sigma", unknown=False,
            basis=("Moved unchanged from Q20 'On-premises / residency constraint' (SME-scored). Excludes=sigma: cloud SaaS only "
                   "(deck slide 22; help.sigmacomputing.com). Looker (original) and ThoughtSpot Software have customer-hosted "
                   "editions, so they stay scored (2), not excluded. Power BI 4 is under review (Report Server is feature-limited)."))

        # ---- phase 3: new blocks, bottom-to-top so earlier positions stay valid
        tmpl = find_rows(QID, "Q03")[0]
        tmpl_end = tmpl + 2

        def create_block(qid, spec, insert_at):
            opts = spec["options"]
            ws.Range(ws.Rows(tmpl), ws.Rows(tmpl_end)).Copy()
            ws.Rows(insert_at).Insert(Shift=-4121)
            xl.CutCopyMode = False
            first = insert_at
            for _ in range(len(opts) - 3):                                  # grow block (merges expand)
                ws.Rows(first + 1).Insert()
            end = first + len(opts) - 1
            # question-level cells
            ws.Cells(first, NUM).Value2 = spec["local"]
            ws.Cells(first, QTXT).Value2 = spec["text"]
            ws.Cells(first, QID).Value2 = qid
            ws.Cells(first, TYPE).Value2 = spec["type"]
            ws.Cells(first, WGT).Value2 = spec["weight"]
            ws.Cells(first, SHOW).MergeArea.ClearContents()
            ws.Cells(first, STG).Value2 = "discovery"
            ws.Cells(first, ORD).Value2 = spec["order"]
            ws.Cells(first, STA).Value2 = "draft"
            ws.Cells(first, STA).Interior.Color = BGR("FCE4D6")
            ws.Cells(first, QID).Interior.Color = BGR("FCE4D6")
            for i, o in enumerate(opts):
                r = first + i
                if isinstance(o, str):
                    o = moved[o.split(":")[1]]
                ws.Cells(r, OPT).Value2 = o["label"]
                ws.Cells(r, OID).Value2 = o["id"]
                ws.Cells(r, EXC).Value2 = o["excludes"] or None
                ws.Cells(r, UNK).Value2 = "Y" if o["unknown"] else None
                ws.Cells(r, BAS).Value2 = o["basis"]
                for t, c in zip(MODEL, SC):
                    ws.Cells(r, c).Value2 = o["scores"][t]
                for t, c in zip(MODEL, RAT):
                    ws.Cells(r, c).Value2 = o["tools"][t]
                ws.Cells(r, H["Rationale"]).Value2 = None
                ws.Cells(r, COMB).Value2 = None
                ws.Cells(r, LEG).Value2 = o.get("legacy")
            return end

        def sep_row(section):          # blank separator row before 'Section n+1' header
            hdr = next(r for r in range(6, 250) if str(ws.Cells(r, 2).Value2).strip() == f"Section {section + 1}")
            return hdr - 1

        for qid in ("Q24", "Q26"):
            create_block(qid, NEW[qid], sep_row(NEW[qid]["section"]))
        at = sep_row(1)
        for qid in ("Q21", "Q22", "Q23", "Q25"):
            at = create_block(qid, NEW[qid], at) + 1

        # ---- phase 4: remove the moved options from Q20 (highest row first)
        # Q20 rows are below the inserted blocks; locate by Q ID block membership (Q23 reuses the id 'tight_budget')
        q20_first = find_rows(QID, "Q20")[0]
        q20_end = block_end(q20_first)
        kill = [r for r in range(q20_first, q20_end + 1) if str(ws.Cells(r, OID).Value2) in ("tight_budget", "on_premises_residency_constraint")]
        assert len(kill) == 2, kill
        for r in sorted(kill, reverse=True):
            ws.Rows(r).Delete()

        # ---- phase 5: regenerate Combined Final Rationale for every option
        rows = [r for r in range(6, 250) if ws.Cells(r, OID).Value2]
        for r in rows:
            if any(ws.Cells(r, c).Value2 is None for c in SC):      # option still awaiting SME scores
                continue
            scores = {t: int(ws.Cells(r, c).Value2) for t, c in zip(MODEL, SC)}
            texts = {t: str(ws.Cells(r, c).Value2 or "") for t, c in zip(MODEL, RAT)}
            ws.Cells(r, COMB).Value2 = combined_text(str(ws.Cells(r, UNK).Value2 or "").upper() == "Y", scores, texts)

        # ---- phase 6: validation for the new columns
        last = max(rows)
        v = ws.Range(ws.Cells(7, STA), ws.Cells(last, STA)).Validation
        v.Delete()
        v.Add(3, 1, 1, "approved,draft")
        v = ws.Range(ws.Cells(7, ORD), ws.Cells(last, ORD)).Validation
        v.Delete()
        v.Add(1, 1, 7, "1")           # whole number >= 1
        # ---- phase 7: Schema sheet
        sc = wb.Worksheets("Schema")
        sc.Cells.Clear()
        info = [
            ("BI Tools sheet: machine-readable schema", "", ""), ("", "", ""), ("Column", "Level", "Meaning"),
            ("Q ID", "question", "Stable question key (Q01-Q26). Never renumber: the JSON, Show if rules and the Flow refer to it."),
            ("Order", "question", "Asking sequence (1..n). The questionnaire runs in Order, not Q ID order. Show if may only reference a question with a lower Order."),
            ("Status", "question", "approved = scores signed off. draft = scores derived from the deck, awaiting SME review; excluded by `excel_to_json.py --exclude-draft`."),
            ("Type", "question", "single = one answer. multi = several answers; their option scores are averaged."),
            ("Weight", "question", "0-5. 0 = not a factor, 5 = the deciding factor. PROVISIONAL until the swing-weighting session (docs/weighting-workshop.md)."),
            ("Show if", "question", "Branch rule. Blank = always shown. Q10=client_team|joint_delivery shows the question when Q10 is any listed option id. ';' = AND."),
            ("Stage", "question", "discovery = scores the shortlist. migration = about the existing reporting suite (Q13-Q15); only Q14-Q15 are gated on Q13."),
            ("Option ID", "option", "Stable key used in the JSON and in Show if. Lower-case letters, digits, underscore. Do not change once released."),
            ("Excludes", "option", "Comma-separated tool ids removed from the ranking when selected (mandatory-constraint filter). Use only for facts, e.g. Sigma is cloud SaaS only."),
            ("Unknown", "option", "Y = the answer carries no information (Other / TBC / Not a priority). Ignored in scoring."),
            ("Score basis", "option", "Where the scores came from. Required for draft questions."),
            ("Combined Final Rationale", "option", "GENERATED from the scores and per-tool rationales (tier words, all six tools, no numbers). Do not edit by hand."),
            ("Combined (legacy)", "option", "The SME's original combined rationale, kept for reference. Not used by the tool."),
            ("Row 4 (Tool ID)", "tool", "Machine id of each scored tool column."),
            ("", "", ""), ("Scoring (see Flow sheet, Recommendation method)", "", ""),
            ("", "", "Per tool: sum(weight x score) over visible, answered, non-unknown questions / sum(weight x 4)."),
            ("", "", "Multi-select: the question score is the average of the selected options. Hidden questions count in neither numerator nor denominator."),
            ("", "", "Excludes are applied first; tools excluded by any selected option are not ranked."),
            ("", "", ""), ("Heatmap-to-score rule used for draft questions", "", ""),
            ("", "", "Deck heatmap 1-5 -> sheet 1-4:  5->4, 4->3, 3->2, 2->1, 1->1.  'Important' / 'Balanced' variants compress the top (4->3)."),
            ("", "", "Neutral answers score 2 for every tool and are flagged Unknown."),
            ("", "", ""), ("Notes", "", ""),
            ("", "", "Yellow score cells are options awaiting SME scores; the converter skips them with a warning."),
            ("", "", "Q20 'Tight budget' moved to Q23 and Q20 'On-premises / residency constraint' moved to Q26 (scores unchanged), to avoid counting one fact several times."),
        ]
        for i, (a, b, c_) in enumerate(info, start=1):
            sc.Cells(i, 1).Value2, sc.Cells(i, 2).Value2, sc.Cells(i, 3).Value2 = a, b, c_
        sc.Columns(1).ColumnWidth = 34
        sc.Columns(2).ColumnWidth = 11
        sc.Columns(3).ColumnWidth = 125
        sc.Cells(1, 1).Font.Bold = True
        sc.Cells(1, 1).Font.Size = 14
        for i, (a, b, c_) in enumerate(info, start=1):
            if a and not b and not c_:
                sc.Cells(i, 1).Font.Bold = True
        sc.Range(sc.Cells(3, 1), sc.Cells(3, 3)).Font.Bold = True
        sc.Range(sc.Cells(3, 1), sc.Cells(3, 3)).Interior.Color = lav
        sc.Range(sc.Cells(1, 3), sc.Cells(len(info), 3)).WrapText = True
        sc.Range(sc.Cells(1, 1), sc.Cells(len(info), 3)).VerticalAlignment = -4160
        ws.Activate()
        wb.Save()
        wb.Close(SaveChanges=True)
        print(f"OK: {len(rows)} option rows; new questions {sorted(NEW)}; moved 2 options out of Q20")
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
