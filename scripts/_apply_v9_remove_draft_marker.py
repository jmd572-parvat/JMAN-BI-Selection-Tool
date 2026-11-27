"""
One-off workbook edit v9: take the words "DRAFT: SME to confirm." out of the Score basis notes (nine answers of Q21 to Q25), at the owner's request.
Only that sentence is removed; the rest of each note (where the mark came from, and any "Adjusted ..." record) is kept. Removing the marker does
not make the marks expert-confirmed, and the page still says so in "How the recommendation is made".

Usage: python scripts/_apply_v9_remove_draft_marker.py data/bi-tools-questions.xlsx
"""
import os
import re
import sys

import win32com.client as win32

MARK = re.compile(r"\s*DRAFT: SME to confirm\.?")


def main(path):
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    n = 0
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        col = H["Score basis"]
        last = max(r for r in range(6, 400) if ws.Cells(r, H["Option ID"]).Value2)
        for r in range(6, last + 1):
            v = ws.Cells(r, col).Value2
            if v and MARK.search(str(v)):
                new = MARK.sub("", str(v)).strip()
                ws.Cells(r, col).Value2 = new
                n += 1
        wb.Save()
        wb.Close(SaveChanges=True)
    finally:
        xl.Quit()
    print(f"{n} notes cleaned")


if __name__ == "__main__":
    main(sys.argv[1])
