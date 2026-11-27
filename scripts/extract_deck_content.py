#!/usr/bin/env python3
"""
Extract the page's reference content from the deck into data/deck/*.json, so nothing is retyped by hand.

    python scripts/extract_deck_content.py "path/to/BI Tools Comparison VS v(5).pptx"

Reads slide XML directly (no third-party library) and asserts the expected shape of every table, so a changed deck fails loudly.
Output (committed, so the site build does not depend on the deck file):
    data/deck/profiles.json    slides 10-15  tool profiles
    data/deck/matrix.json      slides 7, 9   14 criteria x 6 tools, with the deck's gold 'leads on this criterion' markers
    data/deck/migration.json   slides 16, 17, 18, 28, 29  effort, feasibility with reasons, grid, challenges
    data/deck/reference.json   slides 19, 20, 21, 22, 25  decision tree, scenarios, integration, deployment, why-these-tools

Known source problems are DETECTED here and carried in the JSON as `issues`, never silently reproduced:
  * a profile whose 'typical features' repeat another tool's (slide 11 repeats Power BI's)
  * colour markers on slide 21 that contradict that slide's own legend (the markers are dropped; text is kept)
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
TOOL_ID = {"Power BI": "powerbi", "Tableau": "tableau", "Looker": "looker", "ThoughtSpot": "thoughtspot", "Qlik": "qlik", "Sigma": "sigma"}
NAME_OF = {v: k for k, v in TOOL_ID.items()}
OUT = Path("data/deck")
GOLD = "FFC000"


class Deck:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)

    def root(self, n):
        return ET.fromstring(self.z.read(f"ppt/slides/slide{n}.xml"))

    @staticmethod
    def paras(el):
        out = []
        for p in el.iter(A + "p"):
            t = ""
            for node in p.iter():
                if node.tag == A + "t":
                    t += node.text or ""
                elif node.tag == A + "br":
                    t += "\n"
            t = t.replace(" ", " ").strip()
            if t:
                out.append(t)
        return out

    def shapes(self, n):
        """Text shapes in document order: list of paragraph lists."""
        return [self.paras(sp) for sp in self.root(n).iter(P + "sp") if self.paras(sp)]

    def tables(self, n):
        """Every table on the slide as rows of cells; a cell = {'paras': [...], 'fill': 'FFC000'|None}."""
        out = []
        for tbl in self.root(n).iter(A + "tbl"):
            rows = []
            for tr in tbl.iter(A + "tr"):
                row = []
                for tc in tr.iter(A + "tc"):
                    fill = None
                    pr = tc.find(A + "tcPr")
                    if pr is not None and pr.find(A + "solidFill") is not None:
                        fill = pr.find(A + "solidFill")[0].attrib.get("val")
                    row.append({"paras": self.paras(tc), "fill": fill})
                rows.append(row)
            out.append(rows)
        return out


def bullets(paras):
    """Cell paragraphs -> list of items. Splits soft line breaks and strips bullet characters."""
    items = []
    for p in paras:
        for line in p.split("\n"):
            line = re.sub(r"^[•\-\s]+", "", line).strip()
            if line:
                items.append(line)
    return items


def tid(name):
    return TOOL_ID[name.strip()]


def profiles(d):
    tools, issues_global = [], []
    for n in range(10, 16):
        sh = d.shapes(n)
        title = sh[0][0]
        name = title.split("|")[0].strip()
        intro = next(p[0] for p in sh[1:] if p[0].startswith(name) and " is " in p[0][:60] or p[0].startswith(name))
        best = next(p[0] for p in sh if "best suited" in p[0].lower())
        t = d.tables(n)[0]
        assert [c["paras"][0] for c in t[0]] == ["Typical Features", "Unique Features", "Benefits", "AI Capabilities", "Cost Tier"], n
        cells = t[1]
        cost = bullets(cells[4]["paras"])
        cost[0] = re.sub(r"^Cost Tier:\s*", "", cost[0])
        tools.append({"id": tid(name), "name": name, "source": f"slide {n}", "intro": intro, "bestSuited": best,
                      "typicalFeatures": bullets(cells[0]["paras"]), "uniqueFeatures": bullets(cells[1]["paras"]),
                      "benefits": bullets(cells[2]["paras"]), "aiCapabilities": bullets(cells[3]["paras"]),
                      "costTier": cost, "issues": []})
    # detect a profile that copies another tool's typical features
    seen = {}
    for t in tools:
        key = tuple(t["typicalFeatures"])
        if key in seen and seen[key] != t["id"]:
            t["issues"].append(f"The 'typical features' on {t['source']} repeat those of {NAME_OF[seen[key]]} (Power Query and DAX are Power BI features), so they are withheld until the deck is corrected.")
            t["typicalFeatures"] = []
        else:
            seen[key] = t["id"]
    assert len(tools) == 6
    return {"source": "deck slides 10 to 15", "tools": tools}


def matrix(d):
    names = ["Power BI", "Tableau", "Looker", "ThoughtSpot", "Qlik", "Sigma"]
    groups, order = [], []
    for n in (7, 9):
        t = d.tables(n)[0]
        header = [c["paras"][0] if c["paras"] else "" for c in t[0]]
        assert header[2:] == names, (n, header)
        group = None
        for row in t[1:]:
            if row[0]["paras"]:
                group = row[0]["paras"][0]
            crit = row[1]["paras"][0]
            cells = {}
            for nm, c in zip(names, row[2:]):
                ps = c["paras"]
                cells[tid(nm)] = {"headline": ps[0], "detail": " ".join(ps[1:]), "leads": c["fill"] == GOLD}
            if not groups or groups[-1]["name"] != group:
                groups.append({"name": group, "criteria": []})
            groups[-1]["criteria"].append({"name": crit, "slide": n, "cells": cells})
    n_crit = sum(len(g["criteria"]) for g in groups)
    assert n_crit == 14 and len(groups) == 5, (n_crit, len(groups))
    for g in groups:
        for c in g["criteria"]:
            assert any(v["leads"] for v in c["cells"].values()), c["name"]   # every criterion marks at least one leader
    return {"source": "deck slides 7 and 9 (gold = the deck's 'leads on this criterion' marker; ties are marked on every tied tool)", "groups": groups}


def migration(d):
    names = ["Power BI", "Tableau", "Looker", "ThoughtSpot", "Qlik", "Sigma"]
    # slide 16: effort by dimension
    t = d.tables(16)[0]
    assert [c["paras"][0] for c in t[0]][1:] == names
    dims, effort = [], {tid(n): {} for n in names}
    for row in t[1:]:
        dim = row[0]["paras"][0]
        note = " ".join(row[0]["paras"][1:])
        dims.append({"name": dim, "note": note.strip("/ ").strip()})
        for nm, c in zip(names, row[1:]):
            r = c["paras"][0]
            assert r in ("Low", "Medium", "High"), (dim, nm, r)
            effort[tid(nm)][dim] = r
    assert len(dims) == 6
    # slides 17 and 18: tool-to-tool cards with reasons
    feas = {}
    for n in (17, 18):
        frm = None
        for ps in d.shapes(n):
            if ps[0].startswith("FROM\n"):
                frm = tid(ps[0].split("\n", 1)[1])
            elif ps[0].startswith("→") and frm:
                to = tid(ps[0].lstrip("→").strip())
                feas.setdefault(frm, {})[to] = {"rating": ps[1], "reasons": [re.sub(r"^•\s*", "", x) for x in ps[2:]]}
    assert sorted(feas) == sorted(TOOL_ID.values()) and all(len(v) == 5 for v in feas.values()), {k: len(v) for k, v in feas.items()}
    for frm, v in feas.items():
        for to, c in v.items():
            assert c["rating"] in ("Easy", "Moderate", "Hard"), (frm, to, c["rating"])
    # slide 28: full grid including Excel
    t = d.tables(28)[0]
    cols = [c["paras"][0] for c in t[0]][1:]
    assert cols == names, cols
    grid = {}
    for row in t[1:]:
        frm = row[0]["paras"][0]
        key = "excel" if frm == "Excel" else tid(frm)
        grid[key] = {}
        for nm, c in zip(names, row[1:]):
            ps = c["paras"]
            if ps[0] == "N/A":
                continue
            grid[key][tid(nm)] = {"rating": ps[0], "notes": ps[1:]}
    assert len(grid) == 7
    # the grid and the cards must agree on every rating they share
    for frm, v in feas.items():
        for to, c in v.items():
            assert grid[frm][to]["rating"] == c["rating"], (frm, to, grid[frm][to]["rating"], c["rating"])
    # slide 29: typical challenges
    challenges = {}
    for ps in d.shapes(29):
        if ps[0] in TOOL_ID and len(ps) == 2:
            challenges[TOOL_ID[ps[0]]] = ps[1]
    assert len(challenges) == 6
    return {"source": "deck slides 16, 17, 18, 28, 29", "dimensions": dims, "effort": effort, "feasibility": feas, "grid": grid, "challenges": challenges}


def reference(d):
    # slide 19: decision tree -> kept as ecosystem rows (the deck's stop-at-first-Yes order is not reproduced)
    sh = d.shapes(19)
    steps, i = [], 0
    while i < len(sh):
        if re.fullmatch(r"\d", sh[i][0]) and i + 3 < len(sh):
            cond, res = sh[i + 1][0], sh[i + 3]
            steps.append({"condition": cond, "tool": res[0], "note": " ".join(res[1:])})
            i += 4
        else:
            i += 1
    assert len(steps) == 6, steps
    for s in steps:
        s["condition"] = re.sub(r"^(Not [^—]+—\s*|None of the above\s*—\s*)", "", s["condition"])
        s["tool"] = s["tool"].strip()
        assert s["tool"] in TOOL_ID, s
    # slide 20: scenarios
    t = d.tables(20)[0]
    assert [c["paras"][0] for c in t[0]] == ["Client Scenario", "Recommend", "Why"]
    scenarios = [{"scenario": r[0]["paras"][0], "tool": r[1]["paras"][0], "why": r[2]["paras"][0]} for r in t[1:]]
    assert len(scenarios) == 6
    # slide 21: integration (text only; markers dropped, see module docstring)
    tabs = d.tables(21)
    rows = tabs[0]
    names = [c["paras"][0] for c in rows[0]][1:]
    strip = lambda s: re.sub(r"^[\U0001F7E2\U0001F7E8\U0001F7E6]\s*", "", s)
    integ = [{"platform": r[0]["paras"][0], "cells": {tid(n): strip(c["paras"][0]) for n, c in zip(names, r[1:])}} for r in rows[1:]]
    markers = {"\U0001F7E2": "green", "\U0001F7E8": "yellow", "\U0001F7E6": "blue"}
    legend = {markers[r[0]["paras"][0][0]]: strip(r[0]["paras"][0]) for r in tabs[1]}
    conflicts = []
    for r in rows[1:]:
        for n, c in zip(names, r[1:]):
            txt = c["paras"][0]
            m = markers[txt[0]]
            if (m == "yellow" and "Standard" in txt) or (m == "blue" and "Optimized" in txt):
                conflicts.append(f"{r[0]['paras'][0]} / {n}: marker {m} with text '{strip(txt)}'")
    # slide 22: deployment
    t = d.tables(22)[0]
    dnames = [c["paras"][0] for c in t[0]][1:]
    deploy = [{"consideration": r[0]["paras"][0], "cells": {tid(n): c["paras"][0] for n, c in zip(dnames, r[1:])}} for r in t[1:]]
    assert len(deploy) == 4
    # slide 25: why these tools (written for four tools)
    t = d.tables(25)[0]
    why = [{"theme": r[0]["paras"][0], "text": r[1]["paras"][0]} for r in t[1:]]
    return {"source": "deck slides 19, 20, 21, 22, 25", "fastPath": steps, "scenarios": scenarios,
            "integration": {"tools": [tid(n) for n in names], "rows": integ, "legend": legend, "markerConflicts": conflicts},
            "deployment": deploy, "whyTheseTools": why}


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python scripts/extract_deck_content.py <path to the comparison deck .pptx> (the deck is not kept in the repository)")
    path = sys.argv[1]
    d = Deck(path)
    OUT.mkdir(parents=True, exist_ok=True)
    result = {"profiles": profiles(d), "matrix": matrix(d), "migration": migration(d), "reference": reference(d)}
    for name, blob in result.items():
        (OUT / f"{name}.json").write_text(json.dumps(blob, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    p = result["profiles"]["tools"]
    print("profiles:", [(t["id"], len(t["typicalFeatures"]), len(t["aiCapabilities"])) for t in p])
    print("issues:", [(t["id"], t["issues"][0][:70]) for t in p if t["issues"]])
    print("matrix: 14 criteria in", len(result["matrix"]["groups"]), "groups; leaders marked on every criterion")
    m = result["migration"]
    print("migration: effort", len(m["effort"]), "tools x", len(m["dimensions"]), "dimensions; feasibility", sum(len(v) for v in m["feasibility"].values()), "cards; grid rows", list(m["grid"]))
    r = result["reference"]
    print("reference: fastPath", [(s["tool"]) for s in r["fastPath"]], "| scenarios", len(r["scenarios"]), "| integration rows", len(r["integration"]["rows"]),
          "| marker conflicts with the slide's own legend:", len(r["integration"]["markerConflicts"]))


if __name__ == "__main__":
    main()
