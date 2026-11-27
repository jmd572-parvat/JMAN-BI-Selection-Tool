"""
One-off edit v11: one spelling for everything a visitor reads. The labels and page copy were British ("favour", "licence", "standardised") and the
expert reasons and the deck text were American ("modeling", "organizations", "optimized"); everything is now British.

  * the workbook (through Excel, so the Flow drawing and comments are kept): question text, answer labels, the per-tool reasons and the combined
    summaries, plus two label fixes: Q20 "TBC" is spelled out as "To be confirmed" like every other answer, and Q25's ranges use an en dash
    ("1–10 users") like Q15's
  * data/deck/*.json: the deck's own text (the deck is no longer in the repository, so these files are edited in place; run this script again
    after scripts/extract_deck_content.py)
  * the matrix criterion "Visualization" is renamed "Visualisation" in the page's table of which questions bear on which criterion

Usage: python scripts/_apply_v11_uk_spelling.py data/bi-tools-questions.xlsx
"""
import json
import os
import re
import sys
from pathlib import Path

WORDS = {
    "analyze": "analyse", "analyzed": "analysed", "analyzes": "analyses", "analyzing": "analysing",
    "centralize": "centralise", "centralized": "centralised", "centralizes": "centralises",
    "centers": "centres", "customize": "customise", "customized": "customised",
    "favor": "favour", "favoring": "favouring", "formalize": "formalise",
    "maximizes": "maximises", "minimized": "minimised", "minimizing": "minimising",
    "modeled": "modelled", "modeling": "modelling", "optimized": "optimised",
    "organization": "organisation", "organizations": "organisations", "personalized": "personalised",
    "prioritize": "prioritise", "program": "programme", "recognized": "recognised",
    "specialized": "specialised", "standardization": "standardisation", "standardize": "standardise",
    "standardized": "standardised", "standardizing": "standardising",
    "visualization": "visualisation", "visualizations": "visualisations", "visualize": "visualise",
}
RX = re.compile(r"\b(" + "|".join(sorted(WORDS, key=len, reverse=True)) + r")\b", re.I)


def uk(text):
    def one(m):
        w, new = m.group(0), WORDS[m.group(0).lower()]
        if w.isupper() and len(w) > 1:
            return new.upper()
        return new[0].upper() + new[1:] if w[0].isupper() else new
    return RX.sub(one, text)


def deck_strings(x):
    if isinstance(x, str):
        return uk(x)
    if isinstance(x, list):
        return [deck_strings(v) for v in x]
    if isinstance(x, dict):
        return {k: deck_strings(v) for k, v in x.items()}
    return x


def fix_deck():
    n = 0
    for f in ["profiles", "matrix", "migration", "reference"]:
        p = Path("data/deck") / f"{f}.json"
        old = p.read_text(encoding="utf-8")
        new = json.dumps(deck_strings(json.loads(old)), indent=1, ensure_ascii=False) + "\n"
        if new != old:
            p.write_text(new, encoding="utf-8")
            n += 1
    return n


def fix_page():
    p = Path("src/page/playbook.js")
    s = p.read_text(encoding="utf-8")
    new = s.replace("['Visualization', [", "['Visualisation', [")
    if new != s:
        p.write_text(new, encoding="utf-8")
    return new != s


LABELS = {"No material constraints / TBC": "No material constraints / To be confirmed",
          "1-10 users": "1–10 users", "11-50 users": "11–50 users", "51-100 users": "51–100 users"}


def fix_workbook(path):
    import win32com.client as win32
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    cells = labels = 0
    try:
        wb = xl.Workbooks.Open(os.path.abspath(path))
        ws = wb.Worksheets("BI Tools")
        H = {str(ws.Cells(5, c).Value2).strip(): c for c in range(1, 50) if ws.Cells(5, c).Value2}
        text_cols = [H["Question"], H["Options"], H["Rationale"], H["Combined Final Rationale"], H["Combined (legacy)"]] + \
                    [H[t + " Rationale"] for t in ("Power BI", "Looker", "Tableau", "ThoughtSpot", "Sigma", "Qlik")]
        last = max(r for r in range(6, 400) if ws.Cells(r, H["Option ID"]).Value2)
        for r in range(6, last + 1):
            for c in text_cols:
                v = ws.Cells(r, c).Value2
                if not isinstance(v, str) or not v:
                    continue
                new = uk(v)
                if c == H["Options"] and new in LABELS:
                    new = LABELS[new]
                    labels += 1
                if new != v:
                    ws.Cells(r, c).Value2 = new
                    cells += 1
        wb.Save()
        wb.Close(SaveChanges=True)
    finally:
        xl.Quit()
    return cells, labels


if __name__ == "__main__":
    c, l = fix_workbook(sys.argv[1])
    print(f"workbook: {c} cells respelled, {l} labels fixed; deck files changed: {fix_deck()}; criterion renamed in page: {fix_page()}")
