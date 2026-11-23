"""
One-off workbook edit v7 (found by scripts/check_integrity.py, check C1): the summary of Q22 "AI-assisted" lists three "leaders" although
all six tools score 3 on it. Every other answer on which the six tools score alike says so in the same words; this one now does too.
No mark changes. The workbook is edited through Excel only, so the Flow drawing and the threaded comments are kept.

Usage: python scripts/_apply_v7_summary_fix.py data/bi-tools-questions.xlsx
"""
import os
import sys

import win32com.client as win32

TOOLS = ["Power BI", "Looker", "Tableau", "ThoughtSpot", "Sigma", "Qlik"]
ALIKE = "All six platforms fit this answer alike, so it does not change the ranking."


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
        r = next(r for r in range(qrow["Q22"], qrow["Q22"] + 8) if str(ws.Cells(r, OID).Value2).strip() == "ai_assisted")
        scores = [int(ws.Cells(r, H[t]).Value2) for t in TOOLS]
        assert len(set(scores)) == 1, f"Q22/ai_assisted: the six marks are not alike any more: {scores}"
        ws.Cells(r, H["Combined Final Rationale"]).Value2 = ALIKE
        print("Q22/ai_assisted: summary now reads:", ALIKE)
        wb.Save()
        wb.Close(SaveChanges=True)
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
