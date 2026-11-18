"""
One-off workbook edit (validation report fixes F1 + F4):
  F1  Q16-Q20 are no longer gated on Q13 (only Q14, Q15 are about the existing suite); Stage -> discovery.
  F4  Governance de-duplication: interim weights Q03 1, Q05 3, Q06 3, Q07 2, Q08 2, Q09 1.
Edits go through Excel (win32com) so shapes, threaded comments and review tasks are preserved.
Asserts the current value of every cell it touches, so it cannot run twice or on the wrong file.

Usage: python scripts/_apply_fixes_v1.py data/bi-tools-questions.xlsx
"""
import os
import sys

import win32com.client as win32

UNGATE = ["Q16", "Q17", "Q18", "Q19", "Q20"]
OLD_SHOW = "Q13=yes|partial"
WEIGHTS = {"Q03": (1, 1), "Q05": (4, 3), "Q06": (4, 3), "Q07": (3, 2), "Q08": (3, 2), "Q09": (2, 1)}  # old, new


def main(path):
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        hdr = next(r for r in range(1, 15) if str(ws.Cells(r, 4).Value2).strip() == "Q ID")
        col = {str(ws.Cells(hdr, c).Value2).strip(): c for c in range(1, 40) if ws.Cells(hdr, c).Value2}
        rows = {}
        for r in range(hdr + 1, 200):
            v = ws.Cells(r, col["Q ID"]).Value2
            if v:
                rows[str(v).strip()] = r
        assert len(rows) == 20, f"expected 20 questions, found {len(rows)}"
        log = []
        for q in UNGATE:
            r = rows[q]
            show, stage = ws.Cells(r, col["Show if"]).Value2, ws.Cells(r, col["Stage"]).Value2
            assert show == OLD_SHOW and stage == "migration", f"{q}: unexpected state {show!r}/{stage!r} - already applied?"
            ws.Cells(r, col["Show if"]).MergeArea.ClearContents()   # cell is merged across the question block
            ws.Cells(r, col["Stage"]).Value2 = "discovery"
            log.append(f"{q}: Show if {show!r} -> blank; Stage migration -> discovery")
        for q, (old, new) in WEIGHTS.items():
            r = rows[q]
            cur = ws.Cells(r, col["Weight"]).Value2
            assert int(cur) == old, f"{q}: weight is {cur}, expected {old}"
            ws.Cells(r, col["Weight"]).Value2 = new
            if old != new:
                log.append(f"{q}: weight {old} -> {new}")
        # keep the Schema sheet honest about what 'migration' stage and gating now mean
        sc = wb.Worksheets("Schema")
        for r in range(1, 40):
            if str(sc.Cells(r, 1).Value2).strip() == "Stage":
                sc.Cells(r, 3).Value2 = ("discovery = scores the shortlist (Q01-Q12, Q16-Q20). migration = about the existing "
                                         "reporting suite (Q13-Q15); only Q14-Q15 are gated on Q13. Q16-Q20 are asked of everyone.")
        wb.Save()
        wb.Close(SaveChanges=True)
        print("\n".join(log))
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
