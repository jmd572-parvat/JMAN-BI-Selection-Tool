#!/usr/bin/env python3
"""
Convert the BI Tools questionnaire workbook into questions.json for the selection tool.

Usage:
    python scripts/excel_to_json.py [workbook.xlsx] [--out data/questions.json] [--strict] [--no-rationale]

- Columns are located by header text (row containing "Q ID"), never by letter, so the sheet
  can be re-arranged. Tool ids come from the row directly above that header row.
- Question-level cells (Q ID, Type, Weight, Show if, Stage, Question text) are read from the first
  row of each question block (merged cells), option-level cells from every option row.
- Hard validation: any error stops the run with exit code 1 and writes nothing.
  Options with no scores yet (new rows awaiting SME input) are skipped with a warning;
  --strict turns that warning into an error.
- Read-only: this script never saves the workbook (openpyxl would drop Flow shapes/comments).
"""
import argparse
import json
import re
import sys
from pathlib import Path

import openpyxl

from bi_model import TIEBREAK_GROUPS   # single source of the Flow sheet's tie-break order (the engines read it from the JSON)

SCORE_MIN, SCORE_MAX = 1, 4
WEIGHT_MIN, WEIGHT_MAX = 0, 5
TYPES = {"single", "multi"}
STAGES = {"discovery", "migration"}
ID_RE = re.compile(r"^[a-z0-9_]+$")
QID_RE = re.compile(r"^Q(\d{2})$")
# NOTE: no presentation order is emitted for tools on purpose. Any fixed order (the deck's, the sheet's) puts one
# platform first. The UI must order tools by rank, and alphabetically when ranks are shared or nothing is ranked yet.

STATUSES = {"approved", "draft"}
REFERENCES = {"mean", "neutral"}
NEUTRAL_SCORE = 2          # the score every tool gets for a 'not a priority / no requirement' answer
REQUIRED_HEADERS = ["Q ID", "Type", "Weight", "Show if", "Stage", "Order", "Status", "Reference", "Question",
                    "Options", "Option ID", "Excludes", "Unknown", "Score basis"]


def clean(v):
    if v is None:
        return ""
    return str(v).replace("\xa0", " ").strip()


def as_int(v, what, errors):
    if isinstance(v, bool) or v is None or clean(v) == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        errors.append(f"{what}: {v!r} is not a number")
        return None
    if f != int(f):
        errors.append(f"{what}: {v!r} must be a whole number")
        return None
    return int(f)


def parse_show_if(text, where, errors):
    """'Q10=a|b;Q11=c' -> [{'q':'Q10','in':['a','b']}, ...]  (AND of clauses)."""
    clauses = []
    for part in [p.strip() for p in text.split(";") if p.strip()]:
        m = re.fullmatch(r"(Q\d{2})\s*=\s*([a-z0-9_]+(?:\s*\|\s*[a-z0-9_]+)*)", part)
        if not m:
            errors.append(f"{where}: bad 'Show if' clause {part!r} (expected Q10=opt_a|opt_b)")
            continue
        clauses.append({"q": m.group(1), "in": [o.strip() for o in m.group(2).split("|")]})
    return clauses


def load(path, errors, warnings, strict):
    wb = openpyxl.load_workbook(path, data_only=True)
    if "BI Tools" not in wb.sheetnames:
        errors.append("sheet 'BI Tools' not found")
        return None
    ws = wb["BI Tools"]

    # ---- locate header row + columns by name
    hdr_row = next((r for r in range(1, 20) if any(clean(c.value) == "Q ID" for c in ws[r])), None)
    if hdr_row is None:
        errors.append("header row with 'Q ID' not found - has the schema migration been applied?")
        return None
    headers = {clean(c.value): c.column for c in ws[hdr_row] if clean(c.value)}
    for h in REQUIRED_HEADERS:
        if h not in headers:
            errors.append(f"missing header column: {h!r}")
    if errors:
        return None

    # ---- tools: ids in the row above the header sit over the score columns
    tools = []
    for c in ws[hdr_row]:
        tid = clean(ws.cell(hdr_row - 1, c.column).value)
        name = clean(c.value)
        if tid and ID_RE.fullmatch(tid) and name and tid != "tool_id":
            tools.append({"id": tid, "name": name, "col": c.column})
    if not tools:
        errors.append(f"no tool ids found in row {hdr_row - 1} above the score columns")
        return None
    tool_ids = {t["id"] for t in tools}
    # per-tool rationale columns are '<tool name> Rationale'
    rat_cols = {t["id"]: headers.get(f"{t['name']} Rationale") for t in tools}
    combined_col = headers.get("Combined Final Rationale")

    cH = lambda h: headers[h]
    sections, questions = [], []
    cur_section, cur_q = None, None
    for r in range(hdr_row + 1, ws.max_row + 1):
        b = clean(ws.cell(r, 2).value)
        if b.startswith("Section"):
            m = re.match(r"Section\s+(\d+)", b)
            cur_section = {"id": f"S{m.group(1)}" if m else b, "title": clean(ws.cell(r, 3).value)}
            sections.append(cur_section)
            continue
        qid = clean(ws.cell(r, cH("Q ID")).value)
        label = clean(ws.cell(r, cH("Options")).value)
        if qid:
            where = f"{qid} (row {r})"
            qtype = clean(ws.cell(r, cH("Type")).value).lower()
            stage = clean(ws.cell(r, cH("Stage")).value).lower()
            weight = as_int(ws.cell(r, cH("Weight")).value, f"{where} Weight", errors)
            if not QID_RE.fullmatch(qid):
                errors.append(f"{where}: Q ID must look like Q01")
            if qtype not in TYPES:
                errors.append(f"{where}: Type {qtype!r} must be one of {sorted(TYPES)}")
            if stage not in STAGES:
                errors.append(f"{where}: Stage {stage!r} must be one of {sorted(STAGES)}")
            if weight is None:
                errors.append(f"{where}: Weight is missing")
            elif not WEIGHT_MIN <= weight <= WEIGHT_MAX:
                errors.append(f"{where}: Weight {weight} outside {WEIGHT_MIN}-{WEIGHT_MAX}")
            if cur_section is None:
                errors.append(f"{where}: appears before any 'Section' row")
            order = as_int(ws.cell(r, cH("Order")).value, f"{where} Order", errors)
            if order is None:
                errors.append(f"{where}: Order (display sequence) is missing")
            status = clean(ws.cell(r, cH("Status")).value).lower()
            if status not in STATUSES:
                errors.append(f"{where}: Status {status!r} must be one of {sorted(STATUSES)}")
            reference = clean(ws.cell(r, cH("Reference")).value).lower()
            if reference not in REFERENCES:
                errors.append(f"{where}: Reference {reference!r} must be one of {sorted(REFERENCES)}")
            cur_q = {
                "id": qid, "section": (cur_section or {}).get("id"), "order": order, "status": status, "reference": reference,
                "text": clean(ws.cell(r, 3).value), "type": qtype, "weight": weight,
                "stage": stage, "showIf": [], "_showText": clean(ws.cell(r, cH("Show if")).value),
                "options": [], "_row": r,
            }
            if not cur_q["text"]:
                errors.append(f"{where}: question text (column C) is empty")
            questions.append(cur_q)
        if not label:
            continue
        if cur_q is None:
            errors.append(f"row {r}: option {label!r} is not under any question")
            continue
        where = f"{cur_q['id']} / {label!r} (row {r})"
        oid = clean(ws.cell(r, cH("Option ID")).value)
        if not oid:
            errors.append(f"{where}: Option ID is empty")
            continue
        if not ID_RE.fullmatch(oid):
            errors.append(f"{where}: Option ID {oid!r} must be lower-case letters, digits, underscore")
        raw = {t["id"]: ws.cell(r, t["col"]).value for t in tools}
        scores, bad = {}, False
        for tid, v in raw.items():
            iv = as_int(v, f"{where} score[{tid}]", errors)
            if iv is None:
                continue
            if not SCORE_MIN <= iv <= SCORE_MAX:
                errors.append(f"{where}: score[{tid}]={iv} outside {SCORE_MIN}-{SCORE_MAX}")
                bad = True
            scores[tid] = iv
        if not scores:  # nothing scored yet -> pending
            msg = f"{where}: no scores yet - skipped (awaiting SME input)"
            (errors if strict else warnings).append(msg)
            continue
        if len(scores) != len(tools):
            errors.append(f"{where}: scored for {sorted(scores)} but not all of {sorted(tool_ids)}")
            continue
        excl = [x.strip() for x in clean(ws.cell(r, cH("Excludes")).value).split(",") if x.strip()]
        for x in excl:
            if x not in tool_ids:
                errors.append(f"{where}: Excludes has unknown tool id {x!r}")
        unk = clean(ws.cell(r, cH("Unknown")).value).upper()
        if unk not in ("", "Y"):
            errors.append(f"{where}: Unknown must be blank or Y, got {unk!r}")
        rationale = {"summary": clean(ws.cell(r, combined_col).value) if combined_col else "",
                     "tools": {tid: clean(ws.cell(r, c).value) for tid, c in rat_cols.items() if c}}
        basis = clean(ws.cell(r, cH("Score basis")).value)
        if cur_q["status"] == "draft" and not basis:
            errors.append(f"{where}: draft option has scores but no 'Score basis' (provenance is required for drafts)")
        cur_q["options"].append({
            "id": oid, "label": label, "unknown": unk == "Y", "excludes": excl,
            "scores": scores, "rationale": rationale, "scoreBasis": basis, "_row": r,
        })
    return {"tools": tools, "sections": sections, "questions": questions, "tool_ids": tool_ids}


def validate(data, errors, warnings):
    qs = data["questions"]
    by_id = {}
    for q in qs:
        if q["id"] in by_id:
            errors.append(f"duplicate Q ID {q['id']} (rows {by_id[q['id']]['_row']} and {q['_row']})")
        by_id[q["id"]] = q
    nums = sorted(int(QID_RE.fullmatch(i).group(1)) for i in by_id if QID_RE.fullmatch(i))
    if nums and nums != list(range(1, nums[-1] + 1)):
        warnings.append(f"Q IDs are not contiguous: {['Q%02d' % n for n in nums]}")
    seen_order = {}
    for q in qs:
        if q["order"] is not None:
            if q["order"] in seen_order:
                errors.append(f"{q['id']}: Order {q['order']} already used by {seen_order[q['order']]}")
            seen_order[q["order"]] = q["id"]
    for q in qs:
        seen = set()
        for o in q["options"]:
            if o["id"] in seen:
                errors.append(f"{q['id']}: duplicate option id {o['id']!r}")
            seen.add(o["id"])
        if len(q["options"]) < 2:
            errors.append(f"{q['id']}: needs at least 2 scored options, has {len(q['options'])}")
        if q["weight"] == 0:
            warnings.append(f"{q['id']}: weight is 0 - question is shown but does not affect the score")
        known = [o for o in q["options"] if not o["unknown"]]
        nulls = [o for o in q["options"] if o["unknown"]]
        if q["reference"] == "neutral":
            if not nulls:
                errors.append(f"{q['id']}: Reference=neutral needs a 'not a priority / no requirement' answer flagged Unknown")
            for o in nulls:
                if set(o["scores"].values()) != {NEUTRAL_SCORE}:
                    errors.append(f"{q['id']}/{o['id']}: a null answer must score {NEUTRAL_SCORE} for every tool")
            if not known:
                errors.append(f"{q['id']}: Reference=neutral needs at least one informative (non-Unknown) answer")
        elif q["weight"] > 0 and len(known) < 2:
            errors.append(f"{q['id']}: Reference=mean with {len(known)} informative answer(s): after standardisation its "
                          f"weight would have NO effect (a tool is compared with its own average). Add an informative "
                          f"answer, use Reference=neutral, or set the weight to 0 and use it only for Excludes.")
        q["showIf"] = parse_show_if(q.pop("_showText"), q["id"], errors)
        for cl in q["showIf"]:
            ref = by_id.get(cl["q"])
            if ref is None:
                errors.append(f"{q['id']}: Show if references unknown question {cl['q']}")
                continue
            if ref["order"] is not None and q["order"] is not None and ref["order"] >= q["order"]:
                errors.append(f"{q['id']}: Show if must reference a question that is asked EARLIER "
                              f"(Order {ref['order']} of {cl['q']} is not before Order {q['order']})")
            if q["status"] == "approved" and ref["status"] == "draft":
                errors.append(f"{q['id']}: approved question depends on draft question {cl['q']}")
            known = {o["id"] for o in ref["options"]}
            for opt in cl["in"]:
                if opt not in known:
                    errors.append(f"{q['id']}: Show if references unknown option {cl['q']}={opt!r}")


def build_output(data, source, with_rationale, exclude_draft=False, with_basis=True):
    tools = sorted(({"id": t["id"], "name": t["name"]} for t in data["tools"]), key=lambda x: x["name"].lower())
    tool_ids = [t["id"] for t in tools]
    questions = []
    drafts = []
    # average requirement premium per tool, over the questions that ship (mirrors bi_model.requirement_premium)
    num, den = {t: 0.0 for t in tool_ids}, 0.0
    for q in data["questions"]:
        k = [o for o in q["options"] if not o["unknown"]]
        if q["reference"] != "neutral" or not q["weight"] or not k or (exclude_draft and q["status"] == "draft"):
            continue
        share = len(k) / len(q["options"])
        den += q["weight"] * share
        for t in tool_ids:
            num[t] += q["weight"] * share * sum(o["scores"][t] - NEUTRAL_SCORE for o in k) / len(k)
    premium = {t: (num[t] / den if den else 0.0) for t in tool_ids}
    for q in sorted(data["questions"], key=lambda x: x["order"]):
        if q["status"] == "draft":
            drafts.append(q["id"])
            if exclude_draft:
                continue
        opts = []
        for o in q["options"]:
            od = {"id": o["id"], "label": o["label"], "unknown": o["unknown"],
                  "excludes": o["excludes"], "scores": o["scores"]}
            if o["scoreBasis"] and with_basis:
                od["scoreBasis"] = o["scoreBasis"]
            if with_rationale:
                od["rationale"] = o["rationale"]
            opts.append(od)
        known = [o for o in q["options"] if not o["unknown"]]
        qd = {"id": q["id"], "order": q["order"], "status": q["status"], "reference": q["reference"],
              "section": q["section"], "text": q["text"], "type": q["type"], "stage": q["stage"],
              "weight": q["weight"], "showIf": q["showIf"], "options": opts}
        if known:   # neutrality calibration (must mirror bi_model.calibration; the harness checks they agree)
            if q["reference"] == "neutral":
                base = {t: NEUTRAL_SCORE + premium[t] for t in tool_ids}
                cs = {t: [o["scores"][t] - base[t] for o in known] + [0.0] * (len(q["options"]) - len(known))
                      for t in tool_ids}
            else:
                base = {t: sum(o["scores"][t] for o in known) / len(known) for t in tool_ids}
                cs = {t: [o["scores"][t] - base[t] for o in known] for t in tool_ids}
            qd["baseline"] = {t: round(base[t], 9) for t in tool_ids}
            qd["variance"] = {t: round(sum((c - sum(cs[t]) / len(cs[t])) ** 2 for c in cs[t]) / len(cs[t]), 9)
                              for t in tool_ids}
        questions.append(qd)
    return {
        "meta": {"source": source, "scoreScale": [SCORE_MIN, SCORE_MAX], "weightScale": [WEIGHT_MIN, WEIGHT_MAX],
                 "draftQuestions": drafts, "draftsIncluded": not exclude_draft,
                 "tieBreak": [{"name": g, "questions": ids} for g, ids in TIEBREAK_GROUPS],
                 "method": ("z-score against a random client: F = sum(weight*(r-baseline)); S = sqrt(sum(weight^2*variance)); "
                            "z = F/S. baseline = the tool's own mean over informative answers (reference=mean) or the neutral "
                            "score 2 plus the tool's average requirement premium (reference=neutral). See scripts/bi_model.py. "
                            "Tools carry no display order: order by rank, then alphabetically."),
                 "requirementPremium": {t: round(v, 9) for t, v in premium.items()}},
        "tools": tools, "sections": data["sections"], "questions": questions,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workbook", nargs="?", default="data/bi-tools-questions.xlsx")
    ap.add_argument("--out", default="data/questions.json")
    ap.add_argument("--strict", action="store_true", help="treat pending (unscored) options as errors")
    ap.add_argument("--no-rationale", action="store_true", help="omit rationale text (smaller file)")
    ap.add_argument("--exclude-draft", action="store_true",
                    help="leave out questions with Status=draft (use for the production build)")
    ap.add_argument("--no-score-basis", action="store_true",
                    help="leave out the reviewer notes (Score basis); the production build uses this, so they are not in the published data")
    args = ap.parse_args()

    errors, warnings = [], []
    data = load(args.workbook, errors, warnings, args.strict)
    if data is not None:
        validate(data, errors, warnings)
    for w in warnings:
        print(f"WARN  {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"ERROR {e}", file=sys.stderr)
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s) - nothing written.", file=sys.stderr)
        return 1
    out = build_output(data, Path(args.workbook).name, not args.no_rationale, args.exclude_draft, not args.no_score_basis)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    n_opts = sum(len(q["options"]) for q in out["questions"])
    drafts = out["meta"]["draftQuestions"]
    print(f"OK  wrote {out_path} - {len(out['questions'])} questions, {n_opts} options, "
          f"{len(out['tools'])} tools, {len(warnings)} warning(s)"
          + (f"; draft questions {'EXCLUDED' if args.exclude_draft else 'included'}: {', '.join(drafts)}" if drafts else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
