"""
One-off workbook edit v6: the owner's review of the questions and marks, 2026-11-21 (judgement, not a re-run of the checks).

Questions
  1. Q09 "AI governance concerns" is merged into Q06 as one more security and access requirement ("AI governance concerns").
     The scores are those of the former Q09 "Yes". Q09 is removed. (Its yes/maybe/no ladder had the same scores as Q05 "Yes".)
  2. Q06 "External access" is removed: Q19 already asks about external and embedded reporting.
  3. Q18 "Offline / on-premises operation" is removed: Q16 (hybrid / on-premises) and Q26 (vendor-hosted acceptable) already carry that fact,
     with identical scores.

Marks (each noted in Score basis, "was -> now"; all await SME confirmation)
  Q21 Sigma is not a presentation-quality tool: critical 4 -> 3, important 3 -> 2.
  Q01 forecasting and planning: Tableau 1 -> 2, Sigma 4 -> 3 (the answer mixes forecasting with planning).
  Q16 hybrid and Q26 no-self-hosted: Power BI 4 -> 3 (Report Server is feature-limited).
  Q11 beginner and Q12 no training required: Power BI 3 -> 4, Tableau 4 -> 3 (Power BI is the easiest for Excel and Microsoft users).
  Q19 pixel-perfect: Sigma 2 -> 3 (pixel-perfect reports are generally available since March 2026), Tableau 4 -> 3.
  Q20 parallel run: Looker 2 -> 3, ThoughtSpot 2 -> 3 (any tool can run in parallel; a gap of two points was unexplained).
  Q23 cost: ThoughtSpot 1 -> 2 on both options (its published entry plan is not dearer than Tableau's).
  Q22 AI: Looker 2 -> 3 and Sigma 2 -> 3 on both options (Gemini and Conversational Analytics; Sigma Assistant).

Edits go through Excel (win32com) so the Flow drawing and comments survive. Asserts every old value; run once.
Usage: python scripts/_apply_v6_review.py data/bi-tools-questions.xlsx [backup-path]
"""
import os
import shutil
import sys

import win32com.client as win32

TOOLS = ["Power BI", "Looker", "Tableau", "ThoughtSpot", "Sigma", "Qlik"]          # sheet order
TIER = {4: "Strong fit", 3: "Good fit", 2: "Suitable", 1: "Possible but not ideal"}
STAMP = "2026-11-21"

SCORES = [  # (qid, option id, {tool: (old, new)}, {tool: new rationale} or None)
    ("Q21", "critical", {"Sigma": (4, 3)}, None),
    ("Q21", "important", {"Sigma": (3, 2)}, None),
    ("Q01", "improved_forecasting_and_planning", {"Tableau": (1, 2), "Sigma": (4, 3)}, None),
    ("Q16", "hybrid_on_premises", {"Power BI": (4, 3)}, None),
    ("Q26", "no_self_hosted", {"Power BI": (4, 3)}, None),
    ("Q11", "beginner", {"Power BI": (3, 4), "Tableau": (4, 3)}, None),
    ("Q12", "no_training_required", {"Power BI": (3, 4), "Tableau": (4, 3)}, None),
    ("Q19", "pixel_perfect_export_scheduled", {"Sigma": (2, 3), "Tableau": (4, 3)},
     {"Sigma": "Pixel-perfect reports with scheduled PDF and PowerPoint delivery are available (generally available since March 2026); check they cover the exact layouts required.",
      "Tableau": "Formatted dashboards and exports can support scheduled packs, but exact pixel-perfect layouts may need another reporting tool."}),
    ("Q20", "risk_minimized_parallel_run", {"Looker": (2, 3), "ThoughtSpot": (2, 3)}, None),
    ("Q23", "tight_budget", {"ThoughtSpot": (1, 2)}, None),
    ("Q23", "balanced", {"ThoughtSpot": (1, 2)}, None),
    ("Q22", "ai_first", {"Looker": (2, 3), "Sigma": (2, 3)},
     {"Looker": "Gemini in Looker and Conversational Analytics let people ask questions of governed LookML data in plain language.",
      "Sigma": "Sigma Assistant answers questions and builds analyses from the data and context in the workbook."}),
    ("Q22", "ai_assisted", {"Looker": (2, 3), "Sigma": (2, 3)},
     {"Looker": "Gemini in Looker and Conversational Analytics let people ask questions of governed LookML data in plain language.",
      "Sigma": "Sigma Assistant answers questions and builds analyses from the data and context in the workbook."}),
]


def summary(scores, texts):
    by = {}
    for t, s in zip(TOOLS, scores):
        by.setdefault(s, []).append(t)
    parts = [f"{TIER[s]}: {', '.join(by[s])}." for s in (4, 3, 2, 1) if s in by]
    order = sorted(range(6), key=lambda i: (-scores[i], i))
    lead = [i for i in order if scores[i] == max(scores)][:3]
    more = sum(1 for s in scores if s == max(scores)) - len(lead)
    why = " ".join(f"{TOOLS[i]}: {texts[i]}" for i in lead)
    return " ".join(parts) + f" Why the leaders{f' (and {more} more)' if more > 0 else ''}: {why}"


def main(path, backup):
    shutil.copy(path, backup)
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        QID, OID, OPT = H["Q ID"], H["Option ID"], H["Options"]

        def qrows():
            return {str(ws.Cells(r, QID).Value2).strip(): r for r in range(6, 250) if ws.Cells(r, QID).Value2}

        def opt_row(qid, oid):
            q = qrows()[qid]
            return next(r for r in range(q, q + 12) if str(ws.Cells(r, OID).Value2).strip() == oid)

        log = []
        # ---- marks
        for qid, oid, changes, new_text in SCORES:
            r = opt_row(qid, oid)
            for tool, (old, new) in changes.items():
                assert int(ws.Cells(r, H[tool]).Value2) == old, f"{qid}/{oid}: {tool} is {ws.Cells(r, H[tool]).Value2}, expected {old}"
                ws.Cells(r, H[tool]).Value2 = new
            for tool, text in (new_text or {}).items():
                ws.Cells(r, H[f"{tool} Rationale"]).Value2 = text
            scores = [int(ws.Cells(r, H[t]).Value2) for t in TOOLS]
            texts = [str(ws.Cells(r, H[f"{t} Rationale"]).Value2) for t in TOOLS]
            ws.Cells(r, H["Combined Final Rationale"]).Value2 = summary(scores, texts)
            was = ", ".join(f"{t} {o}->{n}" for t, (o, n) in changes.items())
            basis = str(ws.Cells(r, H["Score basis"]).Value2 or "").strip()
            ws.Cells(r, H["Score basis"]).Value2 = (basis + " " if basis else "") + f"Adjusted {STAMP} in the owner's review ({was}); awaiting SME confirmation."
            log.append(f"{qid}/{oid}: {was}")

        # ---- Q09 'yes' becomes an option of Q06, just above its 'To be confirmed'
        src = opt_row("Q09", "yes")
        tbc = opt_row("Q06", "tbc")
        assert src > tbc, "Q09 is expected below Q06 in the sheet"
        ws.Rows(tbc).Insert()
        src += 1                                                  # it moved down with everything below the insert
        ws.Rows(tbc - 1).Copy()
        ws.Rows(tbc).PasteSpecial(-4122)                          # formats only
        xl.CutCopyMode = False
        first, last = OPT, H["Qlik Rationale"]
        ws.Range(ws.Cells(tbc, first), ws.Cells(tbc, last)).Value2 = ws.Range(ws.Cells(src, first), ws.Cells(src, last)).Value2
        ws.Cells(tbc, OPT).Value2 = "AI governance concerns (control over how AI features use the data)"
        ws.Cells(tbc, OID).Value2 = "ai_governance_concerns"
        ws.Cells(tbc, H["Score basis"]).Value2 = f"Merged {STAMP} from the former Q09 'AI governance concerns: Yes'; scores unchanged. Q05 'Yes' and Q09 'Yes' had identical scores."
        log.append("Q06: new option ai_governance_concerns (scores of the former Q09 'Yes')")

        # ---- Q09 goes
        q9 = qrows()["Q09"]
        n_opts = 1                                                # the question row, then the option rows under it
        while not ws.Cells(q9 + n_opts, QID).Value2 and ws.Cells(q9 + n_opts, OID).Value2:
            n_opts += 1
        assert n_opts == 3, f"Q09 should span 3 rows, found {n_opts}"
        ws.Range(ws.Rows(q9), ws.Rows(q9 + n_opts - 1)).Delete()
        log.append(f"Q09: removed ({n_opts} rows)")

        # ---- two duplicated options go
        for qid, oid in (("Q06", "external_access"), ("Q18", "offline_on_premises_operation")):
            r = opt_row(qid, oid)
            ws.Rows(r).Delete()
            log.append(f"{qid}/{oid}: removed")

        # ---- the question numbers of section 2 run 1..n again
        rows = qrows()
        sec2 = next(r for r in range(6, 250) if str(ws.Cells(r, 2).Value2 or "").strip().startswith("Section 2"))
        sec3 = next(r for r in range(sec2 + 1, 250) if str(ws.Cells(r, 2).Value2 or "").strip().startswith("Section 3"))
        n = 0
        for r in range(sec2 + 1, sec3):
            if ws.Cells(r, QID).Value2:
                n += 1
                ws.Cells(r, 2).Value2 = str(n)
        log.append(f"Section 2 renumbered 1..{n}")
        wb.Save()
        wb.Close(SaveChanges=True)
        print("\n".join(log))
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1] + ".bak-v6")
