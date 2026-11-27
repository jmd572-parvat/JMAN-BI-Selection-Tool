#!/usr/bin/env python3
"""
Data and build integrity checks for the BI selection playbook. No dependencies except `openpyxl` (read-only, to read the workbook's
"Score basis" notes; the workbook is never written) and, with --links, the network.

    python scripts/check_integrity.py            # everything that does not need the network
    python scripts/check_integrity.py --links    # also open every web address the page, the data and the docs point to

What it proves, in order:
  A  the artefacts agree:   workbook -> data/questions.json -> site/ -> parity fixture -> the page's own constants
  B  the questions are well formed: ids, weights, branching, options, scores 1-4, neutral answers, exclusions, rationale
  C  every mark has a reason:   the rationale tier lines match the marks; marks that differ from the deck heatmap carry a recorded note
  D  the deck data is complete and clean: matrix, migration grid, effort, challenges, profiles, reference; no broken text
  E  the page's constants point at things that exist (guides, criteria, constraints, documentation links, matrix summaries)
  F  what the repository exposes: tracked files that hold names, e-mail addresses or internal documents (reported as warnings)

Exit status 1 when any check FAILS. Warnings do not fail the run: they are things a person has to decide.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ["looker", "powerbi", "qlik", "sigma", "tableau", "thoughtspot"]          # the JSON's order: alphabetical
TOOL_NAMES = {"looker": "Looker", "powerbi": "Power BI", "qlik": "Qlik", "sigma": "Sigma", "tableau": "Tableau", "thoughtspot": "ThoughtSpot"}
SHEET_TOOLS = {"Power BI": "powerbi", "Looker": "looker", "Tableau": "tableau", "ThoughtSpot": "thoughtspot", "Sigma": "sigma", "Qlik": "qlik"}
TIER = {4: "Strong fit", 3: "Good fit", 2: "Suitable", 1: "Possible but not ideal"}
# The deck heatmap (slide 8), rows used to derive Q21 to Q25, in the deck's column order; rule 5->4, 4->3, 3->2, 2->1, 1->1 (scripts/_apply_v2_new_questions.py)
HEAT = {"viz": (3, 5, 3, 2, 3, 5), "ai": (5, 4, 3, 5, 4, 3), "tco": (5, 3, 3, 2, 4, 4), "community": (5, 4, 3, 3, 4, 2), "scale": (3, 3, 5, 4, 4, 4)}
HEAT_COLS = ["powerbi", "tableau", "looker", "thoughtspot", "qlik", "sigma"]
M54 = {5: 4, 4: 3, 3: 2, 2: 1, 1: 1}
DERIVED = {  # (question, option) -> (heat row, compressed one step?)
    ("Q21", "critical"): ("viz", False), ("Q21", "important"): ("viz", True), ("Q22", "ai_first"): ("ai", False), ("Q22", "ai_assisted"): ("ai", True),
    ("Q23", "tight_budget"): ("tco", False), ("Q23", "balanced"): ("tco", True), ("Q24", "critical"): ("community", False), ("Q24", "important"): ("community", True),
    ("Q25", "u_100_plus"): ("scale", False), ("Q25", "u_51_100"): ("scale", True)}
MOJIBAKE = re.compile("�|â€|Ã[\u0080-¿]|Â[\u0080-¿]")
RESULTS = []


def check(cid, title, ok, detail="", warn=False):
    status = "PASS" if ok else ("WARN" if warn else "FAIL")
    RESULTS.append((cid, status, title, detail))


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def strings(x, path=""):
    """Every string in a JSON value, with where it is."""
    if isinstance(x, str):
        yield path, x
    elif isinstance(x, dict):
        for k, v in x.items():
            yield from strings(v, f"{path}/{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from strings(v, f"{path}[{i}]")


def run(*cmd):
    return subprocess.run(list(cmd), cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


# ------------------------------------------------------------------------------------------------------------------ A
def section_a():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "q.json"
        r = run(sys.executable, "-X", "utf8", "scripts/excel_to_json.py", "--out", str(out))
        regen = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
        check("A1", "data/questions.json is exactly what the workbook converts to", regen is not None and regen == load("data/questions.json"),
              "" if regen is not None else r.stderr[-300:])
    q = load("data/questions.json")
    site = ROOT / "site"
    check("A2", "site/ exists (the hosted page is committed)", (site / "index.html").exists())
    if (site / "index.html").exists():
        diffs = []
        for src, dst in [("src/engine/engine.js", "engine.js"), ("src/engine/session.js", "session.js"), ("src/page/lib.js", "lib.js"),
                         ("src/page/playbook.js", "playbook.js"), ("src/page/styles.css", "styles.css")]:
            if (ROOT / src).read_bytes() != (site / dst).read_bytes():
                diffs.append(dst)
        check("A3", "the hosted page is built from the current source", not diffs, "differs: " + ", ".join(diffs) + " (rebuild with: python scripts/build_site.py --production --with-font)" if diffs else "")
        sq = json.loads((site / "data/questions.json").read_text(encoding="utf-8"))
        a, b = json.loads(json.dumps(q)), json.loads(json.dumps(sq))
        a["meta"].pop("draftsIncluded", None); b["meta"].pop("draftsIncluded", None)
        check("A4", "the hosted question data equals data/questions.json (apart from the drafts flag)", a == b)
        same = all((ROOT / "data/deck" / f).read_bytes() == (site / "data/deck" / f).read_bytes() for f in ["matrix.json", "migration.json", "profiles.json", "reference.json"])
        check("A5", "the hosted deck data equals data/deck", same)
        html = (site / "index.html").read_text(encoding="utf-8")
        check("A6", "the hosted page is a production build: no leftover placeholders, no preview strip, no draft toggle", "{{" not in html and "pv-preview" not in html and '"draftToggle": false' in html and '"preview": false' in html)
        logos = set(re.findall(r'"([a-z]+)": "assets/logos/([^"]+)"', html))
        check("A7", "every tool has a logo file in the hosted page", {t for t, _ in logos} == set(TOOLS) and all((site / "assets/logos" / f).exists() for _, f in logos), str(sorted(logos)))
    fx = load("tests/fixtures/parity.json")
    sha = hashlib.sha256((ROOT / "data/questions.json").read_bytes()).hexdigest()
    check("A8", "the parity fixture was made from the current data/questions.json", fx.get("modelSha256") == sha, "run: python scripts/make_parity_fixtures.py")
    # the docs' own counts
    r = run(sys.executable, "-X", "utf8", "scripts/check_docs.py")
    check("A9", "the documents state the true counts (scripts/check_docs.py)", r.returncode == 0, (r.stdout + r.stderr)[-400:])


# ------------------------------------------------------------------------------------------------------------------ B and C
def read_workbook_notes():
    """{(qid, option id): {'basis': str, 'scores': {tool id: int}}} from the workbook, read only. None when openpyxl is missing."""
    try:
        import openpyxl
    except ImportError:
        return None
    wb = openpyxl.load_workbook(ROOT / "data/bi-tools-questions.xlsx", read_only=True, data_only=True)
    ws = wb["BI Tools"]
    rows = list(ws.iter_rows(min_row=5, values_only=True))
    head = {str(v).strip(): i for i, v in enumerate(rows[0]) if v}
    out, cur = {}, None
    for r in rows[1:]:
        qid = (r[head["Q ID"]] or "").strip() if isinstance(r[head["Q ID"]], str) else ""
        if qid:
            cur = qid
        oid = r[head["Option ID"]]
        if cur and oid:
            scores = {SHEET_TOOLS[t]: r[head[t]] for t in SHEET_TOOLS if r[head[t]] is not None}
            out[(cur, str(oid).strip())] = {"basis": str(r[head["Score basis"]] or ""), "scores": scores, "label": str(r[head["Options"]] or "")}
    return out


def section_bc():
    m = load("data/questions.json")
    qs = m["questions"]
    ids = [q["id"] for q in qs]
    byid = {q["id"]: q for q in qs}
    check("B1", "six tools, alphabetical, no display order", [t["id"] for t in m["tools"]] == TOOLS and all("order" not in t for t in m["tools"]))
    check("B2", "question ids are unique and look like Qnn", len(set(ids)) == len(ids) and all(re.fullmatch(r"Q\d\d", i) for i in ids), ", ".join(ids))
    bad = [q["id"] for q in qs if not (isinstance(q["weight"], int) and 0 <= q["weight"] <= 5)]
    check("B3", "weights are whole numbers from 0 to 5", not bad, str(bad))
    check("B4", "every question is single or multi, and approved (no draft left in the data)", all(q["type"] in ("single", "multi") and q["status"] == "approved" for q in qs) and not m["meta"]["draftQuestions"])
    orders = [q["order"] for q in qs]
    check("B5", "the asking order is unique", len(set(orders)) == len(orders))
    # branching
    probs = []
    for q in qs:
        for c in q.get("showIf") or []:
            p = byid.get(c["q"])
            if not p:
                probs.append(f"{q['id']} depends on missing {c['q']}")
                continue
            if p["order"] >= q["order"]:
                probs.append(f"{q['id']} is asked before the question it depends on ({c['q']})")
            for oid in c["in"]:
                if oid not in {o["id"] for o in p["options"]}:
                    probs.append(f"{q['id']} depends on {c['q']}={oid}, which does not exist")
    check("B6", "branching: every Show if names a real question and answer, asked earlier", not probs, "; ".join(probs))
    probs = []
    for q in qs:
        oids = [o["id"] for o in q["options"]]
        if len(set(oids)) != len(oids):
            probs.append(f"{q['id']}: duplicate option ids")
        if len(oids) < 3:
            probs.append(f"{q['id']}: fewer than three answers")
        if q.get("reference") == "neutral" and not any(o["unknown"] for o in q["options"]):
            probs.append(f"{q['id']}: a requirement question needs a not-scored answer")
        for o in q["options"]:
            if not o["label"].strip():
                probs.append(f"{q['id']}/{o['id']}: empty label")
    check("B7", "options: unique ids, at least three, a not-scored answer on every requirement question, no empty label", not probs, "; ".join(probs))
    probs = []
    for q in qs:
        for o in q["options"]:
            s = o["scores"]
            if sorted(s) != TOOLS:
                probs.append(f"{q['id']}/{o['id']}: scores for {sorted(s)}")
            elif not all(isinstance(v, int) and 1 <= v <= 4 for v in s.values()):
                probs.append(f"{q['id']}/{o['id']}: a score outside 1 to 4")
            if o["unknown"] and (set(s.values()) != {2} or o["excludes"]):
                probs.append(f"{q['id']}/{o['id']}: a not-scored answer must score 2 for every tool and exclude nothing")
            for t in o["excludes"]:
                if t not in TOOLS:
                    probs.append(f"{q['id']}/{o['id']}: excludes unknown tool {t}")
    check("B8", "every answer is scored 1 to 4 for all six tools; not-scored answers are neutral; exclusions name real tools", not probs, "; ".join(probs[:8]))
    ex = [(q["id"], o["id"], o["excludes"]) for q in qs for o in q["options"] if o["excludes"]]
    check("B9", "exactly one answer rules a tool out: Q26 'no_self_hosted' excludes Sigma", ex == [("Q26", "no_self_hosted", ["sigma"])], str(ex))
    # tie-break groups and the page's lists use real questions
    tb = {i for g in m["meta"]["tieBreak"] for i in g["questions"]}
    check("B10", "tie-break groups name questions that exist", tb <= set(ids), str(sorted(tb - set(ids))))
    # rationale
    probs = []
    for q in qs:
        for o in q["options"]:
            r = o.get("rationale") or {}
            tools = r.get("tools") or {}
            if sorted(tools) != TOOLS or any(len(str(tools[t]).strip()) < 25 for t in tools):
                probs.append(f"{q['id']}/{o['id']}: a per-tool reason is missing or too short")
                continue
            s = o["scores"]
            if o["unknown"]:
                continue
            expect = {}
            for t in TOOLS:
                expect.setdefault(TIER[s[t]], set()).add(TOOL_NAMES[t])
            summary = str(r.get("summary", ""))
            if len({s[t] for t in TOOLS}) == 1:
                if "alike" not in summary:
                    probs.append(f"{q['id']}/{o['id']}: all six tools score alike but the summary does not say so")
                continue
            # the tier line is "Strong fit: A, B. Good fit: C. ..." up to "Why the leaders"; the order inside a tier is the sheet's, so compare as sets
            line = summary.split(" Why the leaders")[0]
            got = {}
            for tier in TIER.values():
                mt = re.search(re.escape(tier) + r": ([^.]*)\.", line)
                if mt:
                    got[tier] = {x.strip() for x in mt.group(1).split(",")}
            if got != expect:
                probs.append(f"{q['id']}/{o['id']}: the tier line in the reason ({line!r}) does not match the marks ({ {k: sorted(v) for k, v in expect.items()} })")
    check("C1", "every answer has a reason for each tool, and the tier line of its summary matches the marks", not probs, "; ".join(probs[:6]) + (f" (+{len(probs) - 6} more)" if len(probs) > 6 else ""))
    # the calibration is what the marks say
    sys.path.insert(0, str(ROOT / "scripts"))
    import bi_model as B
    mm = B.load_model(str(ROOT / "data/questions.json"))
    cal_ok = True
    for q in qs:
        k = [o for o in q["options"] if not o["unknown"]]
        if q["weight"] and k and q["id"] in mm["calibration"]:
            for t in TOOLS:
                mean = sum(o["scores"][t] for o in k) / len(k) if q["reference"] == "mean" else None
                if mean is not None and abs(mean - mm["calibration"][q["id"]]["mean"][t]) > 1e-9:
                    cal_ok = False
    check("C2", "the calibration used by the engines is the one the marks give", cal_ok)
    # provenance
    notes = read_workbook_notes()
    if notes is None:
        check("C3", "marks that differ from the deck heatmap carry a recorded reason", False, "openpyxl is not installed: not checked", warn=True)
        return
    probs = []
    for (qid, oid), (row, comp) in DERIVED.items():
        if qid not in byid:
            continue
        exp = {t: M54[v] for t, v in zip(HEAT_COLS, HEAT[row])}
        if comp:
            exp = {t: (v - 1 if v == 4 else v) for t, v in exp.items()}
        got = next((o["scores"] for o in byid[qid]["options"] if o["id"] == oid), None)
        basis = notes.get((qid, oid), {}).get("basis", "")
        for t in TOOLS:
            if got and got[t] != exp[t]:
                tool = TOOL_NAMES[t]
                if f"{tool} {exp[t]}->{got[t]}" in basis or "SME-scored" in basis or f"{tool} {exp[t]} vs {got[t]}" in basis or f"except {tool} {got[t]} vs {exp[t]}" in basis:
                    continue
                probs.append(f"{qid}/{oid}: {tool} is {got[t]}, the heatmap rule gives {exp[t]}, and the Score basis does not say why")
    check("C3", "marks that differ from the deck heatmap carry a recorded reason (Q21 to Q25)", not probs, "; ".join(probs))
    # an "Adjusted" note must describe what the cell now holds
    probs = []
    for (qid, oid), v in notes.items():
        for mt in re.finditer(r"Adjusted [0-9-]+ in the owner's review \(([^)]*)\)", v["basis"]):
            for part in mt.group(1).split(", "):
                g = re.fullmatch(r"(.+?) (\d)->(\d)", part.strip())
                if not g:
                    continue
                t = SHEET_TOOLS.get(g.group(1))
                if t and qid in byid:
                    now = next((o["scores"][t] for o in byid[qid]["options"] if o["id"] == oid), None)
                    if now != int(g.group(3)):
                        probs.append(f"{qid}/{oid}: the note says {g.group(1)} {g.group(2)}->{g.group(3)} but the mark is {now}")
    check("C4", "every 'Adjusted' note in the workbook matches the mark it describes", not probs, "; ".join(probs))
    drafts = [k for k, v in notes.items() if "DRAFT" in v["basis"] and "SME to confirm" in v["basis"]]
    check("C5", "answers still marked 'DRAFT: SME to confirm' in the workbook (the scoring text says they await confirmation)", not drafts,
          f"{len(drafts)} answers: " + ", ".join(f"{a}/{b}" for a, b in sorted(drafts)), warn=True)
    # the workbook and the JSON agree on every mark
    probs = []
    for (qid, oid), v in notes.items():
        if qid in byid:
            o = next((x for x in byid[qid]["options"] if x["id"] == oid), None)
            if o is None:
                continue
            for t, s in v["scores"].items():
                if int(s) != o["scores"][t]:
                    probs.append(f"{qid}/{oid}/{t}")
    check("C6", "the workbook and the JSON hold the same mark for every answer", not probs, ", ".join(probs[:8]))


# ------------------------------------------------------------------------------------------------------------------ D
def section_d():
    mx, mg, pr, rf = (load(f"data/deck/{f}.json") for f in ("matrix", "migration", "profiles", "reference"))
    # matrix
    probs = []
    crit = 0
    for g in mx["groups"]:
        for c in g["criteria"]:
            crit += 1
            if sorted(c["cells"]) != TOOLS:
                probs.append(f"{c['name']}: cells for {sorted(c['cells'])}")
                continue
            if not any(v["leads"] for v in c["cells"].values()):
                probs.append(f"{c['name']}: nobody is marked as leading")
            for t, v in c["cells"].items():
                if not v["headline"].strip() or not v["detail"].strip() or not isinstance(v["leads"], bool):
                    probs.append(f"{c['name']}/{t}: an empty headline or detail")
    check("D1", "matrix: 14 criteria in 5 groups, six tools each, a headline and a detail everywhere, at least one leader per criterion", crit == 14 and len(mx["groups"]) == 5 and not probs, f"{crit} criteria; " + "; ".join(probs))
    # migration
    probs = []
    allowed_effort, allowed_rating = {"Low", "Medium", "High"}, {"Easy", "Moderate", "Hard"}
    dims = [d["name"] for d in mg["dimensions"]]
    for t in TOOLS:
        e = mg["effort"].get(t, {})
        if sorted(e) != sorted(dims) or not set(e.values()) <= allowed_effort:
            probs.append(f"effort for {t}")
        if not str(mg["challenges"].get(t, "")).strip():
            probs.append(f"no challenge note for {t}")
        for to in TOOLS:
            if to == t:
                continue
            c = (mg["grid"].get(t) or {}).get(to)
            f = (mg["feasibility"].get(t) or {}).get(to)
            if not c or c["rating"] not in allowed_rating:
                probs.append(f"grid {t}->{to}")
            if f and f["rating"] != (c or {}).get("rating"):
                probs.append(f"feasibility and grid disagree for {t}->{to}")
        if not (mg["grid"].get("excel") or {}).get(t) or mg["grid"]["excel"][t]["rating"] not in allowed_rating:
            probs.append(f"grid excel->{t}")
    check("D2", "migration: a rating for every from-to pair (and from Excel), effort and challenge for every tool, grid and feasibility agree", not probs, "; ".join(probs[:8]))
    # Q14 follows the grid
    q = load("data/questions.json")
    q14 = next(x for x in q["questions"] if x["id"] == "Q14")
    R = {"Easy": 4, "Moderate": 2, "Hard": 1}
    bad = []
    for o in q14["options"]:
        src = o["id"]
        if o["unknown"]:
            continue
        for to in TOOLS:
            if src == "excel_other":
                exp = R[mg["grid"]["excel"][to]["rating"]]
            elif src == to:
                exp = 4
            else:
                exp = R[mg["grid"][src][to]["rating"]]
            if o["scores"][to] != exp:
                bad.append(f"{src}->{to}: {o['scores'][to]} vs {exp}")
    check("D3", "Q14 'tools in use' follows the migration grid (Easy 4, Moderate 2, Hard 1, same tool 4)", not bad, "; ".join(bad[:8]))
    # profiles
    probs = []
    tools = {p["id"]: p for p in pr["tools"]}
    for t in TOOLS:
        p = tools.get(t)
        if not p:
            probs.append(f"no profile for {t}")
            continue
        if p["name"] != TOOL_NAMES[t] or not p["intro"].strip() or not p["bestSuited"].strip():
            probs.append(f"{t}: name, intro or best-suited line")
        if not re.search(r" is best suited for ", p["bestSuited"], re.I):
            probs.append(f"{t}: the best-suited line does not follow 'X is best suited for'")
        if not p["bestSuited"].lower().startswith(TOOL_NAMES[t].lower()):
            probs.append(f"{t}: the best-suited line does not start with the tool's name")
        empty = [k for k in ("typicalFeatures", "uniqueFeatures", "benefits", "aiCapabilities", "costTier") if not p[k]]
        if empty and not p.get("issues"):
            probs.append(f"{t}: empty {empty} with no issue note")
    check("D4", "profiles: all six, with a name, an intro and a 'best suited for' line that starts with the tool's name; gaps are explained", not probs, "; ".join(probs))
    # reference
    probs = []
    names = set(TOOL_NAMES.values())
    for x in rf["scenarios"] + rf["fastPath"]:
        if x["tool"] not in names:
            probs.append(f"unknown tool name {x['tool']!r}")
    for row in rf["deployment"]:
        if sorted(row["cells"]) != TOOLS or not all(str(v).strip() for v in row["cells"].values()):
            probs.append(f"deployment row {row['consideration']!r}")
    integ = rf["integration"]
    if not set(integ["tools"]) <= set(TOOLS) or any(not set(r["cells"]) <= set(integ["tools"]) for r in integ["rows"]):
        probs.append("integration table tools")
    check("D5", "reference tables: tool names are real, deployment covers all six tools", not probs, "; ".join(probs))
    # text hygiene over every data file
    probs = []
    allowed_case = {"ThoughtSpot", "Power BI", "Looker", "Qlik", "Sigma", "Tableau"}
    for fname, data in [("questions.json", q), ("matrix.json", mx), ("migration.json", mg), ("profiles.json", pr), ("reference.json", rf)]:
        for path, s in strings(data):
            if MOJIBAKE.search(s):
                probs.append(f"{fname}{path}: broken characters")
            if s != s.strip():
                probs.append(f"{fname}{path}: leading or trailing space")
            if "  " in s:
                probs.append(f"{fname}{path}: double space")
            if re.search(r"\b(\w+) \1\b", s, re.I) and not re.search(r"\b(had had|that that|is is)\b", s, re.I):
                probs.append(f"{fname}{path}: repeated word ({re.search(r'\b(\w+) \1\b', s, re.I).group(0)})")
            if re.search(r"\b(TODO|FIXME|XXX|lorem|TBD)\b", s):
                probs.append(f"{fname}{path}: placeholder text")
            for wrong in re.findall(r"\b(Thoughtspot|Powerbi|PowerBI|Power Bi|Quik|Tablaeu|Looker Studio Pro)\b", s):
                if not (wrong == "Looker Studio Pro"):
                    probs.append(f"{fname}{path}: tool name spelled {wrong!r}")
    # the known one is tolerated and handled by the page
    probs = [p for p in probs if "profiles.json/tools[2]/bestSuited" not in p or "Thoughtspot" not in p]
    check("D6", "no broken characters, stray spaces, repeated words, placeholders or misspelled tool names in any data file", not probs, "; ".join(probs[:8]) + (f" (+{len(probs) - 8} more)" if len(probs) > 8 else ""))


# ------------------------------------------------------------------------------------------------------------------ E
def section_e():
    src = (ROOT / "src/page/playbook.js").read_text(encoding="utf-8")
    q = load("data/questions.json")
    mx = load("data/deck/matrix.json")
    ids = {x["id"] for x in q["questions"]}

    def block(name):
        m = re.search(r"var %s = (.*?);\n" % name, src, re.S)
        return m.group(1) if m else ""
    for name, label in [("GUIDE", "guides"), ("HELP", "help lines"), ("CRITERION_QS", "relevance mapping"), ("CONSTRAINT_QS", "constraint list")]:
        used = set(re.findall(r"\bQ\d\d\b", block(name)))
        check(f"E1{label[0]}", f"page constant {name}: every question it names exists", used <= ids and bool(used), str(sorted(used - ids)))
    guide = set(re.findall(r"\b(Q\d\d):", block("GUIDE")))
    check("E2", "every question has a one-line guide, and no guide names a removed question", guide == ids, f"missing {sorted(ids - guide)}; extra {sorted(guide - ids)}")
    docs = dict(re.findall(r"(\w+): '(https://[^']+)'", block("DOCS")))
    check("E3", "documentation links: one https address for each of the six tools", sorted(docs) == TOOLS and all(u.startswith("https://") for u in docs.values()), str(docs))
    gs = block("GROUP_SUMMARY")
    groups = [g["name"] for g in mx["groups"]]
    ok = all(f"'{g}':" in gs for g in groups)
    lines = {g: dict(re.findall(r"(\w+): '([^']+)'", re.search(r"'%s': \{(.*?)\}" % re.escape(g), gs, re.S).group(1))) for g in groups if f"'{g}':" in gs}
    ok = ok and all(sorted(v) == TOOLS for v in lines.values())
    long = [f"{g}/{t}" for g, v in lines.items() for t, s in v.items() if len(s) > 62]
    check("E4", "matrix summaries: a short line for each tool in each of the five groups, none over 62 characters", ok and not long, str(long))
    mfix = re.search(r"var MATRIX_FIX = \{ (\w+): \{ '([^']+)': \{ from: '([^']+)'", src)
    if mfix:
        tool, crit, frm = mfix.groups()
        cell = next((c["cells"].get(tool) for g in mx["groups"] for c in g["criteria"] if c["name"] == crit), None)
        check("E5", "the matrix correction applies to text that is really in the matrix", bool(cell) and cell["detail"] == frm, f"{tool} / {crit}")
    sec = {s for s in re.findall(r"\bsectionOf\b", src)}
    sections = re.findall(r"\{ id: '(\d)', title: '([^']+)'", src)
    check("E6", "five areas, numbered 1 to 5", [a for a, _ in sections] == ["1", "2", "3", "4", "5"])
    # every question lands in an area
    s_of = lambda x: {"S1": "1", "S2": "2", "S3": "3"}.get(x["section"], "4" if x["id"] in ("Q16", "Q18", "Q19") else "5")
    by = {}
    for x in q["questions"]:
        by.setdefault(s_of(x), []).append(x["id"])
    check("E7", "every area has questions of its own", all(by.get(str(i)) for i in range(1, 6)), str({k: len(v) for k, v in sorted(by.items())}))
    dfix = re.findall(r"(\w+): \{ text: '([^']+)', url: (\w+) \}", src)
    urls = dict(re.findall(r"var (\w+) = '(https://[^']+)'", src))
    check("E8", "deployment corrections each cite a vendor address", all(u in urls for _, _, u in dfix) and len(dfix) >= 4, str(dfix[:2]))


# ------------------------------------------------------------------------------------------------------------------ F
def section_f():
    tracked = run("git", "ls-files").stdout.splitlines()
    internal = [f for f in tracked if f.startswith("dumps/") and f.lower().endswith((".pptx", ".xlsx", ".docx", ".pdf"))]
    check("F1", "tracked internal documents (decks and workbooks as received)", not internal, ", ".join(internal) + " (anyone who can read the repository can open them)", warn=True)
    people = {}
    for f in tracked:
        p = ROOT / f
        if f.lower().endswith((".xlsx", ".pptx", ".docx")) and p.exists():
            try:
                z = zipfile.ZipFile(p)
                for n in z.namelist():
                    if n.endswith(("person.xml", "core.xml")):
                        x = z.read(n).decode("utf8", "replace")
                        for mail in re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", x):
                            people.setdefault(f, set()).add(mail)
                        for who in re.findall(r'displayName="([^"]*)"', x) + re.findall(r"<dc:creator>([^<]+)</dc:creator>", x) + re.findall(r"<cp:lastModifiedBy>([^<]+)</cp:lastModifiedBy>", x):
                            if who != "JMAN" and not who.startswith("Reviewer"):        # the neutral labels left by scripts/_strip_workbook_names.py
                                people.setdefault(f, set()).add(who)
            except zipfile.BadZipFile:
                pass
        elif f.endswith((".md", ".json", ".js", ".py", ".html", ".csv")) and p.exists():
            txt = p.read_text(encoding="utf-8", errors="replace")
            for mail in set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", txt)):
                if not mail.endswith((".png", ".jpg")):
                    people.setdefault(f, set()).add(mail)
    check("F2", "names and e-mail addresses stored in tracked files", not people,
          "; ".join(f"{f}: {len(v)} ({', '.join(sorted(v)[:3])}...)" for f, v in sorted(people.items())), warn=True)
    ext = re.findall(r"(?:src|href)=\"(https://[^\"]+)\"", (ROOT / "site/index.html").read_text(encoding="utf-8")) if (ROOT / "site/index.html").exists() else []
    others = [u for u in ext if "fonts.g" not in u]
    check("F3", "the hosted page asks other sites for nothing (the font stylesheet is the one request, which tells Google the visitor's address)", not ext, ", ".join(ext), warn=not others)
    src = (ROOT / "src/page/playbook.js").read_text(encoding="utf-8") + (ROOT / "src/page/index.html").read_text(encoding="utf-8")
    gets = re.findall(r"\bget\('([^']+)'", src)
    others = re.findall(r"fetch\(([^)]*)\)", src)
    ok = bool(gets) and all(g.startswith("data/") for g in gets) and others == ["u"] and not re.search(r"XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts", src)
    check("F4", "the page only fetches its own data files, and sends nothing anywhere", ok, f"fetched: {gets}; other fetches: {others}")


# ------------------------------------------------------------------------------------------------------------------ links
def section_links():
    import concurrent.futures
    import urllib.request
    urls = set()
    for f in ["src/page/playbook.js", "src/page/index.html", "README.md"] + [str(p.relative_to(ROOT)) for p in (ROOT / "docs").glob("*.md")] + [str(p.relative_to(ROOT)) for p in (ROOT / "data/deck").glob("*.json")]:
        txt = (ROOT / f).read_text(encoding="utf-8", errors="replace")
        for u in re.findall(r"https?://[^\s'\"<>)\]]+", txt):
            urls.add(u.rstrip(".,;:"))
    urls = sorted(u for u in urls if "fonts.g" not in u and "localhost" not in u and "github.io" not in u)

    def probe(u):
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(u, method=method, headers={"User-Agent": "Mozilla/5.0 (integrity check)"})
                with urllib.request.urlopen(req, timeout=25) as r:
                    return u, r.status
            except urllib.error.HTTPError as e:
                if method == "HEAD" and e.code in (400, 403, 405, 501):
                    continue
                return u, e.code
            except Exception as e:                                  # noqa: BLE001
                if method == "HEAD":
                    continue
                return u, type(e).__name__
        return u, "?"
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(probe, urls))
    dead = [(u, s) for u, s in res if s in (404, 410) or (isinstance(s, int) and s >= 500)]
    blocked = [(u, s) for u, s in res if s not in (200, 301, 302) and (u, s) not in dead]
    check("L1", f"web addresses that open ({len(urls)} checked)", not dead, "; ".join(f"{s} {u}" for u, s in dead))
    check("L2", "web addresses that could not be verified (refused automated reads, or timed out)", not blocked, "; ".join(f"{s} {u}" for u, s in blocked[:10]), warn=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--links", action="store_true", help="also open every web address (needs the network)")
    a = ap.parse_args()
    for fn in (section_a, section_bc, section_d, section_e, section_f) + ((section_links,) if a.links else ()):
        try:
            fn()
        except Exception as e:                                       # noqa: BLE001
            RESULTS.append((fn.__name__, "FAIL", "the check itself crashed", f"{type(e).__name__}: {e}"))
    w = {s: sum(1 for r in RESULTS if r[1] == s) for s in ("PASS", "WARN", "FAIL")}
    for cid, status, title, detail in RESULTS:
        print(f"[{status}] {cid:4} {title}")
        if detail and status != "PASS":
            print(f"        {detail}")
    print(f"\nSUMMARY: {w['PASS']} pass, {w['WARN']} warn, {w['FAIL']} fail")
    sys.exit(1 if w["FAIL"] else 0)


if __name__ == "__main__":
    main()
