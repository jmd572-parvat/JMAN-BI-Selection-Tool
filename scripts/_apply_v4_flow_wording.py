"""
One-off workbook edit v4: align question wording with the Flow sheet ("the Flow wins for the question list").

Found by the page-design audit (see docs/page-design.md, section 10). Text only: no score, weight, option id or branching changes.
Q06's Flow text carries a facilitator instruction ("Ask this for every client, regardless of Q5") which is NOT question text; it
belongs in the 'Why we ask' help text, so only the question itself is used here.

Edits go through Excel (win32com) so Flow shapes and comments survive. Asserts every old value; run once.
Usage: python scripts/_apply_v4_flow_wording.py data/bi-tools-questions.xlsx
"""
import os
import sys

import win32com.client as win32

QUESTION_TEXT = {  # qid: (current, Flow)
    "Q04": ("Which enterprise ecosystem do you primarily operate within? (Microsoft / Google Cloud / Salesforce / Databricks-Snowflake / hybrid)",
            "Which enterprise ecosystem do you primarily operate within?"),
    "Q06": ("What are your security needs — RLS, SSO, data residency?", "What are your security and access requirements?"),
    "Q07": ("Do you have a defined data model or semantic layer in your existing reporting today?",
            "Do you have a defined data model or semantic layer in existing reporting?"),
    "Q09": ("Are there any AI governance concerns to be aware about?", "Are there any AI governance concerns to be aware of?"),
    "Q10": ("Who will be building these reports.", "Who will build the reports?"),
    "Q11": ("What’s the team’s technical skill level (SQL, DAX)?", "What is the delivery team's technical skill level (SQL, DAX, modelling)?"),
    "Q12": ("How much training/change management can you support, if needed?", "How much training and change management can the client support?"),
}
OPTION_LABEL = {  # (qid, option id): (current, Flow)
    ("Q01", "exit_readiness_and_investor_reporting"): (
        "Exit readiness and investor reporting, supporting the exit narrative with credible, consistent metrics, demonstrating business performance, scalability and value creation",
        "Exit readiness and investor reporting, supporting a credible narrative on performance, scalability and value creation"),
}


def clean(v):
    return str(v).replace("\xa0", " ").strip() if v is not None else ""


def main(path):
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        QID, QTXT, OPT, OID = H["Q ID"], H["Question"], H["Options"], H["Option ID"]
        rows = {str(ws.Cells(r, QID).Value2).strip(): r for r in range(6, 250) if ws.Cells(r, QID).Value2}
        log = []
        for qid, (old, new) in QUESTION_TEXT.items():
            cell = ws.Cells(rows[qid], QTXT)
            assert clean(cell.Value2) == clean(old), f"{qid}: unexpected text {clean(cell.Value2)!r}"
            cell.Value2 = new
            log.append(f"{qid}: question text aligned with the Flow")
        for (qid, oid), (old, new) in OPTION_LABEL.items():
            r = next(r for r in range(rows[qid], rows[qid] + 20) if str(ws.Cells(r, OID).Value2).strip() == oid)
            cell = ws.Cells(r, OPT)
            assert clean(cell.Value2) == clean(old), f"{qid}/{oid}: unexpected label {clean(cell.Value2)!r}"
            cell.Value2 = new
            log.append(f"{qid}/{oid}: option label aligned with the Flow")
        wb.Save()
        wb.Close(SaveChanges=True)
        print("\n".join(log))
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
