"""
One-off workbook edit v10: the experts have approved the marks, so the Score basis notes no longer say they are awaiting confirmation.
Only the status words change: "awaiting SME confirmation" / "awaiting SME review" / "SME to confirm" become a plain record that the experts
approved. Where each mark came from, and every "Adjusted ..." record, is kept. No mark changes.

Usage: python scripts/_apply_v10_confirmed_notes.py data/bi-tools-questions.xlsx
"""
import os
import re
import sys

import win32com.client as win32

RULES = [
    (re.compile(r";\s*awaiting SME confirmation\."), "; approved by the experts."),
    (re.compile(r",\s*awaiting SME review\."), "; approved by the experts."),
    (re.compile(r";\s*SME to confirm\."), "."),
]


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
            if not v:
                continue
            new = str(v)
            for rx, rep in RULES:
                new = rx.sub(rep, new)
            if new != str(v):
                ws.Cells(r, col).Value2 = new
                n += 1
        wb.Save()
        wb.Close(SaveChanges=True)
    finally:
        xl.Quit()
    print(f"{n} notes updated")


if __name__ == "__main__":
    main(sys.argv[1])
