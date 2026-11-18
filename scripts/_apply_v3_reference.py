"""
One-off workbook migration v3: adds the question-level `Reference` column used by the bias-free engine.

  Reference = mean     each tool's score is compared with ITS OWN average over the question's informative answers.
                       Right for categorical questions (ecosystem, skills, scale ...): no answer means "no information".
  Reference = neutral  the question has a 'not a priority / no requirement' answer (flagged Unknown, scored 2 for every
                       tool). That answer is the reference: a stated requirement lifts the tools that meet it, an absent
                       one changes nothing. Used for the requirement-style questions Q21-Q26.

Edits go through Excel (win32com) so Flow shapes and comments survive. Run once.
Usage: python scripts/_apply_v3_reference.py data/bi-tools-questions.xlsx
"""
import os
import sys

import win32com.client as win32

NEUTRAL = {"Q21", "Q22", "Q23", "Q24", "Q25", "Q26"}
BGR = lambda h: int(h[4:6] + h[2:4] + h[0:2], 16)


def main(path):
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        assert "Reference" not in H, "already migrated"
        at = H["Status"] + 1
        ws.Columns(at).Insert(Shift=-4161, CopyOrigin=1)
        ws.Cells(5, at).Value2 = "Reference"
        ws.Cells(5, at).Interior.Color = BGR("E9E4FA")
        ws.Cells(5, at).Font.Bold = True
        ws.Columns(at).ColumnWidth = 10
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        QID, OID, REF = H["Q ID"], H["Option ID"], H["Reference"]
        starts = [r for r in range(6, 250) if ws.Cells(r, QID).Value2]
        assert len(starts) == 26, len(starts)

        def block_end(first):
            r = first
            while ws.Cells(r + 1, OID).Value2 and not ws.Cells(r + 1, QID).Value2:
                r += 1
            return r
        n_neutral = 0
        for first in starts:
            qid = str(ws.Cells(first, QID).Value2).strip()
            ref = "neutral" if qid in NEUTRAL else "mean"
            n_neutral += ref == "neutral"
            end = block_end(first)
            ws.Cells(first, REF).Value2 = ref
            rng = ws.Range(ws.Cells(first, REF), ws.Cells(end, REF))
            rng.Merge()
            rng.VerticalAlignment = -4108
            rng.HorizontalAlignment = -4108
        last = max(r for r in range(6, 250) if ws.Cells(r, OID).Value2)
        v = ws.Range(ws.Cells(7, REF), ws.Cells(last, REF)).Validation
        v.Delete()
        v.Add(3, 1, 1, "mean,neutral")
        # Schema sheet: document the column and the engine
        sc = wb.Worksheets("Schema")
        row = 1
        while sc.Cells(row, 1).Value2 is not None or sc.Cells(row + 1, 1).Value2 is not None:
            if str(sc.Cells(row, 1).Value2).strip() == "Status":
                break
            row += 1
        sc.Rows(row + 1).Insert()
        sc.Cells(row + 1, 1).Value2 = "Reference"
        sc.Cells(row + 1, 2).Value2 = "question"
        sc.Cells(row + 1, 3).Value2 = ("mean = compare each tool with its own average over this question's informative answers (categorical questions). "
                                       "neutral = the question has a 'not a priority' answer (Unknown, all 2): that answer is the reference, so a stated "
                                       "requirement lifts the tools that meet it and an absent one changes nothing. See scripts/bi_model.py.")
        last_row = 1
        while sc.Cells(last_row + 1, 1).Value2 is not None or sc.Cells(last_row + 2, 1).Value2 is not None or sc.Cells(last_row + 1, 3).Value2 is not None:
            last_row += 1
        base = last_row + 2
        notes = [("Bias-free ranking", "", ""),
                 ("", "", "Scores are the SME's absolute fit (1-4). The engine does NOT rank by their raw sum, because a tool with higher or more extreme scores would win regardless of the client."),
                 ("", "", "Instead each tool's total is standardised against a random client (a z-score), so that with no information every tool has the same expected score and volatility."),
                 ("", "", "Ties are broken only by the client's answers (ecosystem, then governance, then risk and cost) and otherwise shared. Tool order never matters.")]
        for i, (a, b, c_) in enumerate(notes):
            sc.Cells(base + i, 1).Value2, sc.Cells(base + i, 2).Value2, sc.Cells(base + i, 3).Value2 = a, b, c_
        sc.Cells(base, 1).Font.Bold = True
        sc.Range(sc.Cells(1, 3), sc.Cells(base + len(notes), 3)).WrapText = True
        ws.Activate()
        wb.Save()
        wb.Close(SaveChanges=True)
        print(f"OK: Reference column added; {n_neutral} neutral, {len(starts) - n_neutral} mean")
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
