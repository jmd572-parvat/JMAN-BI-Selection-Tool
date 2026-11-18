#!/usr/bin/env python3
"""
Documentation integrity check: keeps docs/page-design.md (and the other docs) tied to the data and the code.

    python scripts/check_docs.py            # verify; exit 1 on any problem
    python scripts/check_docs.py --write    # regenerate the question appendix in docs/page-design.md, then verify

Checks
  1  the question appendix in page-design.md is exactly what data/questions.json implies (regenerated, not hand-edited)
  2  numbers quoted in the docs match the data and the engine (question counts, criteria count, thresholds, tool list order)
  3  every relative link and every `path/like/this` that points into the repo exists
  4  every 'slide N' reference is a real slide (1-29)
  5  no stale figures remain anywhere in docs/ (values known to have been wrong)
"""
import json
import re
import sys
from pathlib import Path

DOCS = sorted(Path("docs").glob("*.md"))
PAGE = Path("docs/page-design.md")
J = json.loads(Path("data/questions.json").read_text(encoding="utf-8"))
Q = sorted(J["questions"], key=lambda q: q["order"])
ENGINE = Path("src/engine/engine.js").read_text(encoding="utf-8")
START, END = "<!-- APPENDIX:START -->", "<!-- APPENDIX:END -->"
ASSUMED_TYPE = {"Q14", "Q15", "Q16", "Q17", "Q18", "Q19", "Q20"}   # select type is NOT specified by the Flow sheet
problems = []


def fail(msg):
    problems.append(msg)


def page_section(q):
    if q["section"] == "S1":
        return "1 Business context and goals"
    if q["section"] == "S2":
        return "2 Data, security and governance"
    if q["section"] == "S3":
        return "3 Skills and change readiness"
    return "4 Existing reporting" if q["id"] in ("Q13", "Q14", "Q15") else "5 Data landscape and delivery"


def asked_when(q):
    if not q["showIf"]:
        return "Always"
    by_id = {x["id"]: x for x in Q}
    out = []
    for c in q["showIf"]:
        pq = by_id[c["q"]]
        labels = [o["label"] for o in pq["options"] if o["id"] in c["in"]]
        out.append(f'Only if "{pq["text"].rstrip("?.")}" is ' + " or ".join(f'"{l}"' for l in labels))
    return "; ".join(out)


def options(q):
    bits = []
    for o in q["options"]:
        tag = " *(not scored)*" if o["unknown"] else ""
        if o["excludes"]:
            tag += f" *(rules out {', '.join(o['excludes'])})*"
        bits.append(o["label"] + tag)
    return "; ".join(bits)


def appendix():
    lines, cur = [], None
    for q in Q:
        sec = page_section(q)
        if sec != cur:
            cur = sec
            lines += [f"\n**Section {sec}**\n", "| # | Question | Select | Asked | Options |", "|---|---|---|---|---|"]
        kind = "one" if q["type"] == "single" else "several"
        if q["id"] in ASSUMED_TYPE:
            kind += " (assumed)"
        draft = " **[draft]**" if q["status"] == "draft" else ""
        lines.append(f"| {q['id']} | {q['text']}{draft} | {kind} | {asked_when(q)} | {options(q)} |")
    return "\n".join(lines) + "\n"


def build_block():
    return f"{START}\n{appendix()}\n{END}"


def read_block(text):
    if START not in text or END not in text:
        return None
    return text[text.index(START):text.index(END) + len(END)]


# ------------------------------------------------------------------ 1. appendix
text = PAGE.read_text(encoding="utf-8")
if "--write" in sys.argv:
    block = read_block(text)
    if block is None:
        sys.exit(f"markers {START} / {END} not found in {PAGE}")
    PAGE.write_text(text.replace(block, build_block()), encoding="utf-8")
    text = PAGE.read_text(encoding="utf-8")
    print("appendix regenerated")
if read_block(text) != build_block():
    fail("question appendix in docs/page-design.md is out of date: run `python scripts/check_docs.py --write`")

# ------------------------------------------------------------------ 2. facts
n_total = len(Q)
first_visible = sum(1 for q in Q if not q["showIf"])
tools_alpha = sorted(t["name"] for t in J["tools"])
too_close = re.search(r"var TOO_CLOSE_Z = ([0-9.]+);", ENGINE).group(1)
clear = re.search(r"var CLEAR_LEAD_Z = ([0-9.]+);", ENGINE).group(1)
must_contain = {
    f"{n_total} questions": "total question count",
    f"{first_visible} are asked at the start": "questions visible at the start",
    f"`TOO_CLOSE_Z = {too_close}` and `CLEAR_LEAD_Z = {clear}`": "the engine's confidence constants, exactly as in src/engine/engine.js",
    ", ".join(tools_alpha[:-1]) + " or " + tools_alpha[-1]: "tool list in alphabetical order",
}
for needle, what in must_contain.items():
    if needle not in text:
        fail(f"page-design.md should state {what}: expected the text {needle!r}")
n_multi = sum(1 for q in Q if q["type"] == "multi")
if f"{n_multi} multi-select questions" not in text:
    fail(f"page-design.md should state '{n_multi} multi-select questions'")

# ------------------------------------------------------------------ 3. links and paths
repo_roots = ("docs/", "scripts/", "src/", "data/", "tests/")
for doc in DOCS:
    body = doc.read_text(encoding="utf-8")
    for target in re.findall(r"\]\((?!https?://|#|mailto:)([^)#\s]+)", body):
        if not (doc.parent / target).exists():
            fail(f"{doc}: broken link ({target})")
    for tok in set(re.findall(r"`([A-Za-z0-9_./\-]+)`", body)):
        if tok.startswith(repo_roots) and not any(c in tok for c in "*{<") and not Path(tok).exists():
            fail(f"{doc}: `{tok}` does not exist")

# ------------------------------------------------------------------ 4. slide references
for doc in DOCS:
    body = doc.read_text(encoding="utf-8")
    for tag in re.findall(r"\[Deck ([^\]]+)\]", body):                  # evidence labels such as [Deck s3 to s6] or [Deck s17]
        for n in re.findall(r"s(\d+)", tag):
            if not 1 <= int(n) <= 29:
                fail(f"{doc}: evidence label [Deck {tag}] cites slide {n}, which does not exist (the deck has 29)")
    for m in re.finditer(r"[Ss]lides? (\d+)(?:(?:,| and| to| and) (\d+))*", body):
        for n in re.findall(r"\d+", m.group(0)):
            if not 1 <= int(n) <= 29:
                fail(f"{doc}: slide {n} does not exist (the deck has 29)")

# ------------------------------------------------------------------ 5. figures known to be wrong
STALE = {r"\b15 criteri": "the deck has 14 criteria (slides 7 and 9 hold 7 each)", r"15-criterion": "the deck has 14 criteria",
         r"0\.15 z": "the calibrated thresholds are 0.3 and 0.5 z", r"60% of (the )?visible": "the 60% coverage threshold was not supported by the simulation",
         r"about 12 min read": "read time was invented; the marketplace computes it", r"WCAG AA on the palette": "pink, teal, cyan and orchid fail AA as text on white"}
for doc in DOCS:
    body = doc.read_text(encoding="utf-8")
    for pat, why in STALE.items():
        for m in re.finditer(pat, body):
            ctx = body[max(0, m.start() - 80):m.end() + 40].replace("\n", " ")
            if re.search(r"earlier|not supported|wrong|stale|known to be|replaced", ctx.lower()):
                continue                      # the doc is explicitly recording the correction
            fail(f"{doc}: stale figure {m.group(0)!r} ({why}) near: ...{ctx}...")

if problems:
    print("DOCS CHECK FAILED")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print(f"docs check passed ({len(DOCS)} documents, {n_total} questions, thresholds {too_close}/{clear} z)")
