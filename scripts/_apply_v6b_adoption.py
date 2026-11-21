"""
One-off workbook edit v6b (follows v6): take back the Power BI 3 -> 4 on Q11 "Beginner" and Q12 "No training required".

After v6, Power BI tied ThoughtSpot and Sigma on those answers, so for a client who wants plain-English search or a spreadsheet tool the
"never rank a tool above one that fits at least as well on every answer" rule put Power BI first even though ThoughtSpot or Sigma won on
score. The deck's own wording backs the old marks: Power BI is quickest for Microsoft 365 users, but modelling in DAX still takes skill,
while ThoughtSpot is "zero training". Only Tableau 4 -> 3 on both answers (from v6) stays.

Usage: python scripts/_apply_v6b_adoption.py data/bi-tools-questions.xlsx
"""
import os
import sys

import win32com.client as win32

TOOLS = ["Power BI", "Looker", "Tableau", "ThoughtSpot", "Sigma", "Qlik"]
TIER = {4: "Strong fit", 3: "Good fit", 2: "Suitable", 1: "Possible but not ideal"}


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
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        QID, OID = H["Q ID"], H["Option ID"]
        qrow = {str(ws.Cells(r, QID).Value2).strip(): r for r in range(6, 250) if ws.Cells(r, QID).Value2}
        for qid, oid in (("Q11", "beginner"), ("Q12", "no_training_required")):
            r = next(r for r in range(qrow[qid], qrow[qid] + 8) if str(ws.Cells(r, OID).Value2).strip() == oid)
            assert int(ws.Cells(r, H["Power BI"]).Value2) == 4 and int(ws.Cells(r, H["Tableau"]).Value2) == 3, f"{qid}/{oid}: unexpected scores"
            ws.Cells(r, H["Power BI"]).Value2 = 3
            scores = [int(ws.Cells(r, H[t]).Value2) for t in TOOLS]
            texts = [str(ws.Cells(r, H[f"{t} Rationale"]).Value2) for t in TOOLS]
            ws.Cells(r, H["Combined Final Rationale"]).Value2 = summary(scores, texts)
            ws.Cells(r, H["Score basis"]).Value2 = "Adjusted 2026-11-21 in the owner's review (Tableau 4->3); awaiting SME confirmation."
            print(f"{qid}/{oid}: Power BI back to 3, Tableau stays 3")
        wb.Save()
        wb.Close(SaveChanges=True)
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
