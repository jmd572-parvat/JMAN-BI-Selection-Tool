"""
One-off workbook edit v5: close the known gaps, as decided by the owner on 2026-11-18.

1. Three Flow answers that had no scores get PROPOSED scores and rationales (Q06 data residency; Q12 limited upskilling capacity and
   no capacity for change). They are marked "Proposed" in Score basis so a reviewer can find them; the page treats them as approved.
2. Q17 and Q20 are only asked when the client has existing reporting (Show if Q13=yes|partial, like Q14 and Q15).
3. The six Draft questions (Q21 to Q26) are marked approved.

Edits go through Excel (win32com) so the Flow drawing and comments survive. Asserts every old value; run once.
Usage: python scripts/_apply_v5_known_gaps.py data/bi-tools-questions.xlsx
"""
import os
import shutil
import sys

import win32com.client as win32

TOOLS = ["Power BI", "Looker", "Tableau", "ThoughtSpot", "Sigma", "Qlik"]          # sheet order
TIER = {4: "Strong fit", 3: "Good fit", 2: "Suitable", 1: "Possible but not ideal"}
DECK_RES = "deck slide 22, data residency control"

NEW = {  # (qid, option id): ([scores in sheet order], [rationale per tool in sheet order], basis)
    ("Q06", "data_residency_requirement"): (
        [3, 2, 4, 2, 3, 4],
        ["Data stays in a chosen regional Azure data centre, with Power BI Report Server on-premises for stricter rules; confirm the exact region for the client.",
         "Cloud-only and tied to the chosen Google Cloud region, so residency is met only where Google Cloud offers a suitable region.",
         "The region can be chosen, or the platform can be self-hosted with Tableau Server, so it can follow most residency rules.",
         "Cloud-only with limited region choice, so a strict residency rule may not be met; validate before committing.",
         "Cloud-only, but data stays in the client's own warehouse region, which usually satisfies residency; confirm where Sigma's own metadata sits.",
         "Full control when run on-premises or hybrid, which is why it suits regulated clients with strict residency rules."],
        "Proposed 2026-11-18, awaiting SME review. From the deck's data residency row (slide 22): Power BI regional Azure data centers; Tableau choose region or self-host; Looker tied to Google Cloud region; ThoughtSpot limited region choice; Qlik full control if on-prem/hybrid; Sigma tied to warehouse region."),
    ("Q12", "limited_upskilling_capacity"): (
        [4, 2, 3, 4, 4, 2],
        ["Familiar Microsoft and Excel habits keep the learning load light; advanced DAX still needs someone with time to learn it.",
         "LookML has a learning curve and the model-first workflow needs training time that is in short supply.",
         "An intuitive interface helps analysts, but advanced visuals take experience that limited training time may not build.",
         "Natural-language search has a low learning curve for business users; whoever maintains the model still needs some training.",
         "A spreadsheet-style interface is quick to pick up; warehouse governance needs a little training.",
         "The associative model takes time to learn, which limited training capacity may not allow."],
        "Proposed 2026-11-18, awaiting SME review. Placed between 'Can upskill' and 'No training required', using the deck's ease-of-adoption row (slide 7)."),
    ("Q12", "no_capacity_for_change"): (
        [3, 1, 3, 3, 4, 2],
        ["Familiar Microsoft and Excel habits ease adoption, but moving reporting to a new tool still asks for change the client says it cannot absorb.",
         "A new modelling workflow (LookML, Git) is a large change, a poor fit when there is no capacity for change.",
         "The interface is intuitive for analysts, but a new tool still changes how reports are built and governed.",
         "Search is easy for business users, but curated models and a new way of asking questions still need change management.",
         "The closest to a spreadsheet, so the smallest change in how people already work.",
         "The associative approach is a new way of working that needs guided change."],
        "Proposed 2026-11-18, awaiting SME review. Stricter than 'No training required': the client cannot absorb a new way of working at all. Based on the deck's ease-of-adoption row (slide 7)."),
}


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


def main(path):
    shutil.copy(path, path + ".bak-v5")
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        QID, OID, SHOW, STATUS = H["Q ID"], H["Option ID"], H["Show if"], H["Status"]
        qrow = {str(ws.Cells(r, QID).Value2).strip(): r for r in range(6, 250) if ws.Cells(r, QID).Value2}
        log = []
        for (qid, oid), (scores, texts, basis) in NEW.items():
            r = next(r for r in range(qrow[qid], qrow[qid] + 20) if str(ws.Cells(r, OID).Value2).strip() == oid)
            for t in TOOLS:
                assert ws.Cells(r, H[t]).Value2 in (None, ""), f"{qid}/{oid}: {t} already has a score"
            for t, s, txt in zip(TOOLS, scores, texts):
                ws.Cells(r, H[t]).Value2 = s
                ws.Cells(r, H[f"{t} Rationale"]).Value2 = txt
            ws.Cells(r, H["Score basis"]).Value2 = basis
            ws.Cells(r, H["Combined Final Rationale"]).Value2 = summary(scores, texts)
            log.append(f"{qid}/{oid}: scores {scores}")
        for qid in ("Q17", "Q20"):
            cell = ws.Cells(qrow[qid], SHOW)
            assert cell.Value2 in (None, ""), f"{qid}: already has a Show if"
            cell.Value2 = "Q13=yes|partial"
            log.append(f"{qid}: only asked when Q13=yes|partial")
        for qid in ("Q21", "Q22", "Q23", "Q24", "Q25", "Q26"):
            cell = ws.Cells(qrow[qid], STATUS)
            assert str(cell.Value2).strip() == "draft", f"{qid}: status is {cell.Value2!r}"
            cell.Value2 = "approved"
            log.append(f"{qid}: approved")
        wb.Save()
        wb.Close(SaveChanges=True)
        print("\n".join(log))
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
