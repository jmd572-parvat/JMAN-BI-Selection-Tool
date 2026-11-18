"""
One-off migration: adds the machine-readable schema columns to the BI Tools workbook.

Run through Excel itself (win32com) so the Flow sheet shapes, threaded comments and
review tasks are preserved. openpyxl must NOT be used to save this workbook.

Usage:  python scripts/_apply_schema_to_workbook.py data/bi-tools-questions.xlsx
Idempotency: NOT idempotent. Run once on a fresh copy of the original workbook.
"""
import os
import re
import sys

import win32com.client as win32

# --------------------------------------------------------------------------- config
# (section index, local '#' value in column B) -> global question id (matches the Flow diagram)
QID_MAP = {
    (1, "1"): "Q01", (1, "2"): "Q02", (1, "3"): "Q03", (1, "4"): "Q04",
    (2, "5"): "Q05", (2, "2"): "Q06", (2, "1"): "Q07", (2, "3"): "Q08", (2, "4"): "Q09",
    (3, "1"): "Q10", (3, "1.1"): "Q11", (3, "2"): "Q12",
    (4, "1"): "Q13", (4, "2"): "Q14", (4, "3"): "Q15", (4, "4"): "Q16",
    (4, "5"): "Q17", (4, "6"): "Q18", (4, "7"): "Q19", (4, "8"): "Q20",
}
SHOW_MIGRATION = "Q13=yes|partial"
SHOW_SKILLS = "Q10=client_team|joint_delivery"
# qid: (type, weight, show_if, stage)  -- weights are STARTER values for the team to review
Q_META = {
    "Q01": ("multi", 3, "", "discovery"),
    "Q02": ("multi", 2, "", "discovery"),
    "Q03": ("single", 1, "", "discovery"),
    "Q04": ("single", 5, "", "discovery"),
    "Q05": ("single", 4, "", "discovery"),
    "Q06": ("multi", 4, "", "discovery"),
    "Q07": ("single", 3, "", "discovery"),
    "Q08": ("single", 3, "", "discovery"),
    "Q09": ("single", 2, "", "discovery"),
    "Q10": ("single", 2, "", "discovery"),
    "Q11": ("single", 3, SHOW_SKILLS, "discovery"),
    "Q12": ("single", 2, SHOW_SKILLS, "discovery"),
    "Q13": ("single", 0, "", "migration"),
    "Q14": ("multi", 3, SHOW_MIGRATION, "migration"),
    "Q15": ("single", 2, SHOW_MIGRATION, "migration"),
    "Q16": ("multi", 4, SHOW_MIGRATION, "migration"),
    "Q17": ("multi", 3, SHOW_MIGRATION, "migration"),
    "Q18": ("multi", 3, SHOW_MIGRATION, "migration"),
    "Q19": ("multi", 3, SHOW_MIGRATION, "migration"),
    "Q20": ("multi", 4, SHOW_MIGRATION, "migration"),
}
# label fixes, applied inside a question block: qid -> {old: new}
LABEL_FIXES = {
    "Q02": {"Operational teams and Business managers": "Operational teams and business managers"},
    "Q04": {"Google": "Google Cloud", "None": "None / Not yet defined"},
    "Q06": {
        "Basic": "Basic access",
        "Role Based": "Role-based access / RLS",
        "Enterprise security (SSO, and granular access controls)": "Enterprise security (SSO and granular controls)",
        "External Access": "External access",
        "TBC": "To be confirmed",
    },
    "Q07": {"partial": "Partial"},
    "Q08": {"No Governance": "No formal governance", "Partial": "Partially governed",
            "Fully governed practices": "Fully governed"},
    "Q10": {"Joint Delivery": "Joint delivery"},
    "Q11": {"Begineer": "Beginner"},
    "Q12": {"Full support": "Full support for upskilling", "No Training Required": "No training required"},
    "Q15": {"Medium — 26–200 reports / 202–500 users": "Medium — 26–200 reports / 201–500 users",
            "Large — over 200 reports / 500 users": "Large — over 200 reports / over 500 users"},
}
# explicit option ids where the auto-slug is not what other rules / tool ids need
ID_OVERRIDES = {
    ("Q04", "None / Not yet defined"): "none",
    ("Q05", "To be confirmed"): "tbc",
    ("Q06", "To be confirmed"): "tbc",
    ("Q13", "Partial / Departmental only"): "partial",
    ("Q14", "Power BI"): "powerbi",
    ("Q14", "ThoughtSpot"): "thoughtspot",
    ("Q14", "Excel / Other"): "excel_other",
}
UNKNOWN_LABELS = {  # options excluded from scoring (answer carries no information)
    "Other / Not yet defined", "None / Not yet defined", "To be confirmed",
    "No material constraints / TBC",
}
TOOL_IDS = ["powerbi", "looker", "tableau", "thoughtspot", "sigma", "qlik"]  # sheet order E..J

XL_FORMAT_FROM_RIGHT = 1
XL_UP = -4162
BGR = lambda hexrgb: int(hexrgb[4:6] + hexrgb[2:4] + hexrgb[0:2], 16)  # "RRGGBB" -> Excel BGR int


def slug(label):
    s = re.split(r"\s[—–]\s|\s\(", label)[0].lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    if len(s) > 40:
        s = s[:40].rsplit("_", 1)[0]
    return s


def blank(v):
    return v is None or str(v).replace("\xa0", " ").strip() == ""


def find_blocks(ws, last_row, option_col):
    """Return [(section_idx, local_no, first_row, last_row)] using column B (question numbers)."""
    starts, section = [], 0
    for r in range(6, last_row + 1):
        b = ws.Cells(r, 2).Value2
        if b is None:
            continue
        if isinstance(b, float):
            b = str(int(b)) if b == int(b) else repr(b)   # Excel returns numbers as floats: 1.0 -> '1'
        b = str(b).strip()
        if b.startswith("Section"):
            section = int(b.split()[1])
        else:
            starts.append((section, b, r))
    blocks = []
    for i, (sec, no, r) in enumerate(starts):
        nxt = starts[i + 1][2] if i + 1 < len(starts) else last_row + 1
        end = nxt - 1
        # trim trailing blank / section-header rows
        while end > r and blank(ws.Cells(end, option_col).Value2):
            end -= 1
        blocks.append((sec, no, r, end))
    return blocks


def last_option_row(ws, option_col):
    r = 6
    for i in range(6, 200):
        if not blank(ws.Cells(i, option_col).Value2):
            r = i
    return r


def build_schema_sheet(wb, lav):
    """(Re)create the Schema notes sheet right after Flow."""
    try:
        sc = wb.Worksheets("Schema")
        sc.Cells.Clear()
    except Exception:
        sc = wb.Worksheets.Add(None, wb.Worksheets("Flow"))
        sc.Name = "Schema"
    rows = [
        ("BI Tools sheet: machine-readable schema", "", ""),
        ("", "", ""),
        ("Column", "Level", "Meaning"),
        ("Q ID", "question", "Global question key, Q01-Q20, matches the Flow sheet. Filled on the first row of each question block."),
        ("Type", "question", "single = one answer. multi = several answers; their option scores are averaged."),
        ("Weight", "question", "0-5. 0 = not a factor, 5 = the deciding factor. Starter values - review with the team."),
        ("Show if", "question", "Branch rule. Blank = always shown. Format: Q10=client_team|joint_delivery (show when the answer is any listed option id). Join several with ';' for AND."),
        ("Stage", "question", "discovery = scores the shortlist. migration = adjusts it when the client has an existing BI tool."),
        ("Option ID", "option", "Stable key used in the JSON and in Show if. Lower-case letters, digits, underscore. Do not change once released."),
        ("Excludes", "option", "Comma-separated tool ids removed from the ranking when this option is selected (mandatory-constraint filter), e.g. looker,thoughtspot. Blank = none."),
        ("Unknown", "option", "Y = answer carries no information (Other / TBC / None). Ignored in scoring."),
        ("Row 4 (Tool ID)", "tool", "Machine id of each scored tool column. The converter maps columns by header text and these ids."),
        ("", "", ""),
        ("Scoring (see Flow sheet, Recommendation method)", "", ""),
        ("", "", "Per tool: sum(weight x score) over visible, answered, non-unknown questions / sum(weight x 4)."),
        ("", "", "Multi-select: the question score is the average of the selected option scores."),
        ("", "", "Questions hidden by Show if count in neither numerator nor denominator."),
        ("", "", "Excludes are applied first; tools excluded by any selected option are not ranked."),
        ("", "", "Tie-break: ecosystem fit (Q04), then governance/security fit, then implementation risk and cost."),
        ("", "", ""),
        ("Notes", "", ""),
        ("", "", "Rows are in the original sheet order; the JSON is ordered by Q ID. Q05-Q09 sit in a different physical order from the Flow."),
        ("", "", "Yellow score cells are new options awaiting SME scores and rationale. The converter skips options with no scores and warns."),
    ]
    for i, (a, b, c_) in enumerate(rows, start=1):
        sc.Cells(i, 1).Value2, sc.Cells(i, 2).Value2, sc.Cells(i, 3).Value2 = a, b, c_
    sc.Columns(1).ColumnWidth = 30
    sc.Columns(2).ColumnWidth = 11
    sc.Columns(3).ColumnWidth = 120
    sc.Cells(1, 1).Font.Bold = True
    sc.Cells(1, 1).Font.Size = 14
    for r in (3, 14, 21):
        sc.Range(sc.Cells(r, 1), sc.Cells(r, 3)).Font.Bold = True
    sc.Range(sc.Cells(3, 1), sc.Cells(3, 3)).Interior.Color = lav
    sc.Range(sc.Cells(1, 3), sc.Cells(len(rows), 3)).WrapText = True
    sc.Range(sc.Cells(1, 1), sc.Cells(len(rows), 3)).VerticalAlignment = -4160
    return sc


def main(path):
    path = os.path.abspath(path)
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(path)
        ws = wb.Worksheets("BI Tools")
        yellow = BGR("FFF2CC")

        # ------------------------------------------------ phase A: rows + labels (original columns)
        # Q12 block (orig rows 62-64): add 'Limited upskilling capacity' and 'No capacity for change'
        assert str(ws.Cells(62, 4).Value2) == "Full support" and ws.Cells(64, 4).Value2 == "No Training Required"
        ws.Rows(63).Insert()                                       # blank at 63
        ws.Cells(63, 4).Value2 = "Limited upskilling capacity"
        ws.Rows(65).Insert()                                       # blank at 65, 'No Training Required' -> 66
        ws.Range(ws.Cells(65, 4), ws.Cells(65, 18)).Value2 = ws.Range(ws.Cells(66, 4), ws.Cells(66, 18)).Value2
        ws.Range(ws.Cells(66, 4), ws.Cells(66, 18)).ClearContents()
        ws.Cells(66, 4).Value2 = "No capacity for change"
        for r in (63, 66):
            ws.Range(ws.Cells(r, 5), ws.Cells(r, 10)).Interior.Color = yellow
        # Q06 block (rows 40-44): add 'Data residency requirement' before 'TBC'
        assert ws.Cells(44, 4).Value2 == "TBC"
        ws.Rows(44).Insert()
        ws.Cells(44, 4).Value2 = "Data residency requirement"
        ws.Range(ws.Cells(44, 5), ws.Cells(44, 10)).Interior.Color = yellow

        # stray ", v" typo on the exit-readiness option
        c = ws.Cells(15, 4)
        assert str(c.Value2).endswith(", v")
        c.Value2 = str(c.Value2)[:-3]

        last = last_option_row(ws, 4)
        blocks = find_blocks(ws, last, 4)
        assert len(blocks) == len(QID_MAP), f"expected {len(QID_MAP)} blocks, found {len(blocks)}"
        # label fixes (exact match within the block)
        for sec, no, s, e in blocks:
            qid = QID_MAP[(sec, no)]
            fixes = LABEL_FIXES.get(qid, {})
            found = set()
            for r in range(s, e + 1):
                v = ws.Cells(r, 4).Value2
                if v is None:
                    continue
                v = str(v).replace("\xa0", " ").strip()
                if v in fixes:
                    ws.Cells(r, 4).Value2 = fixes[v]
                    found.add(v)
            missing = set(fixes) - found
            assert not missing, f"{qid}: label(s) not found: {missing}"

        # ------------------------------------------------ phase B: insert schema columns
        ws.Columns("D:H").Insert(Shift=-4161, CopyOrigin=XL_FORMAT_FROM_RIGHT)   # Q ID..Stage
        # Options now in I (9); insert Option ID, Excludes, Unknown at J..L
        ws.Columns("J:L").Insert(Shift=-4161, CopyOrigin=XL_FORMAT_FROM_RIGHT)
        COL = dict(qid=4, type=5, weight=6, show=7, stage=8, opt=9, optid=10, excl=11, unk=12, score0=13)
        headers = {4: "Q ID", 5: "Type", 6: "Weight", 7: "Show if", 8: "Stage",
                   10: "Option ID", 11: "Excludes", 12: "Unknown"}
        widths = {4: 8, 5: 9, 6: 9, 7: 30, 8: 11, 9: 40, 10: 22, 11: 18, 12: 10}
        for c_, w in widths.items():
            ws.Columns(c_).ColumnWidth = w
        lav = BGR("E9E4FA")
        for c_, h in headers.items():
            cell = ws.Cells(5, c_)
            cell.Value2 = h
            cell.Interior.Color = lav
            cell.Font.Bold = True
        # tool ids row (row 4) above the six score columns
        ws.Cells(4, 12).Value2 = "Tool ID →"
        for i, t in enumerate(TOOL_IDS):
            ws.Cells(4, COL["score0"] + i).Value2 = t
        rng = ws.Range(ws.Cells(4, 12), ws.Cells(4, 18))
        rng.Font.Italic = True
        rng.Font.Size = 9
        rng.Font.Color = BGR("7A7A8C")
        rng.HorizontalAlignment = -4108

        # ------------------------------------------------ phase C: fill values + merge question-level cells
        last = last_option_row(ws, COL["opt"])
        blocks = find_blocks(ws, last, COL["opt"])
        assert len(blocks) == len(QID_MAP), f"expected {len(QID_MAP)} blocks, found {len(blocks)}"
        report = []
        for sec, no, s, e in blocks:
            qid = QID_MAP[(sec, no)]
            qtype, weight, show, stage = Q_META[qid]
            ws.Cells(s, COL["qid"]).Value2 = qid
            ws.Cells(s, COL["type"]).Value2 = qtype
            ws.Cells(s, COL["weight"]).Value2 = weight
            if show:
                ws.Cells(s, COL["show"]).Value2 = show
            ws.Cells(s, COL["stage"]).Value2 = stage
            for k in ("qid", "type", "weight", "show", "stage"):
                col = COL[k]
                r_ = ws.Range(ws.Cells(s, col), ws.Cells(e, col))
                r_.Merge()
                r_.VerticalAlignment = -4108
                r_.HorizontalAlignment = -4108
                r_.WrapText = True
            ws.Cells(s, COL["weight"]).Interior.Color = BGR("F6F1FF")
            seen = set()
            for r in range(s, e + 1):
                label = ws.Cells(r, COL["opt"]).Value2
                if label is None:
                    continue
                label = str(label).replace("\xa0", " ").strip()
                oid = ID_OVERRIDES.get((qid, label)) or slug(label)
                assert oid not in seen, f"{qid}: duplicate option id {oid!r}"
                seen.add(oid)
                ws.Cells(r, COL["optid"]).Value2 = oid
                if label in UNKNOWN_LABELS:
                    ws.Cells(r, COL["unk"]).Value2 = "Y"
                for k in ("optid", "unk", "excl"):
                    ws.Cells(r, COL[k]).HorizontalAlignment = -4108 if k == "unk" else -4131
                report.append((qid, oid, label))

        # ------------------------------------------------ phase D: validation
        def dv(col, formula, kind, msg):
            r_ = ws.Range(ws.Cells(7, col), ws.Cells(last, col))
            r_.Validation.Delete()
            r_.Validation.Add(kind, 1, 1, *formula)
            r_.Validation.InputMessage = msg
            r_.Validation.ErrorMessage = msg
        # type 3 = list, type 1 = whole number
        dv(COL["type"], ("single,multi",), 3, "single or multi")
        dv(COL["stage"], ("discovery,migration",), 3, "discovery or migration")
        dv(COL["unk"], ("Y",), 3, "Y marks an option that carries no information (excluded from scoring)")
        wv = ws.Range(ws.Cells(7, COL["weight"]), ws.Cells(last, COL["weight"]))
        wv.Validation.Delete()
        wv.Validation.Add(1, 1, 1, "0", "5")   # whole number between 0 and 5
        wv.Validation.InputMessage = "Question weight 0-5 (0 = not a factor, 5 = the deciding factor)"
        wv.Validation.ErrorMessage = "Whole number 0-5"

        # legend text: clarify that the 1-4 scale is the option score, not the question weight
        hit = ws.Cells.Find("Weightage is added on a scale of 4")
        assert hit is not None, "legend cell not found"
        hit.Value2 = "Option scores use a scale of 1-4. Question weights (column F) use 0-5."

        # ------------------------------------------------ phase E: Schema notes sheet
        build_schema_sheet(wb, lav)

        wb.Worksheets("BI Tools").Activate()
        wb.Save()
        wb.Close(SaveChanges=True)
        print(f"OK: {len(blocks)} question blocks, {len(report)} options written")
        for q, o, l in report:
            print(f"  {q:4} {o:42} <- {l[:70]}")
    finally:
        xl.Quit()


if __name__ == "__main__":
    main(sys.argv[1])
