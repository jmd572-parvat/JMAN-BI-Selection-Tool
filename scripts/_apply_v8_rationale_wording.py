"""
One-off workbook edit v8: plainer wording for the per-tool reasons (the "<Tool> Rationale" columns), at the owner's request after review feedback
that the sentences read as machine-written. Wording only: no mark, option, question or tool changes. Each cell is replaced only if it still holds
the exact text it was drafted from, and the same text is replaced inside "Combined Final Rationale", which quotes the leading tools' reasons.

Usage: python scripts/_apply_v8_rationale_wording.py data/bi-tools-questions.xlsx proposals.json keys.json
  proposals.json  {"<n>": "new text"}    keys.json  {"old text": ["Q01/option_id/tool_id", ...]}  (n = position of the old text in keys.json)
"""
import json
import os
import sys

import win32com.client as win32

TOOL_COL = {"powerbi": "Power BI", "looker": "Looker", "tableau": "Tableau", "thoughtspot": "ThoughtSpot", "sigma": "Sigma", "qlik": "Qlik"}


def main(path, proposals, keys_file):
    props = {int(k): v for k, v in json.load(open(proposals, encoding="utf-8")).items()}
    keys = json.load(open(keys_file, encoding="utf-8"))
    olds = list(keys.keys())
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    changed = summaries = 0
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        QID, OID, COMB = H["Q ID"], H["Option ID"], H["Combined Final Rationale"]
        last = max(r for r in range(6, 400) if ws.Cells(r, OID).Value2)
        qrows = [(r, str(ws.Cells(r, QID).Value2).strip()) for r in range(6, last + 1) if ws.Cells(r, QID).Value2]
        bounds = {q: (r, (qrows[i + 1][0] if i + 1 < len(qrows) else last + 1)) for i, (r, q) in enumerate(qrows)}
        for n, new in sorted(props.items()):
            old = olds[n]
            for k in keys[old]:
                q, o, t = k.split("/")
                a, b = bounds[q]
                r = next(r for r in range(a, b) if str(ws.Cells(r, OID).Value2).strip() == o)
                cell = ws.Cells(r, H[TOOL_COL[t] + " Rationale"])
                cur = str(cell.Value2).strip()
                assert cur == old.strip(), f"{k}: the cell no longer holds the drafted text:\n  {cur}\n  {old}"
                cell.Value2 = new
                changed += 1
                comb = ws.Cells(r, COMB)
                text = str(comb.Value2 or "")
                if old.strip() in text:
                    comb.Value2 = text.replace(old.strip(), new)
                    summaries += 1
        wb.Save()
        wb.Close(SaveChanges=True)
    finally:
        xl.Quit()
    print(f"{changed} reasons reworded; the same wording carried into {summaries} combined summaries")


if __name__ == "__main__":
    main(*sys.argv[1:4])
