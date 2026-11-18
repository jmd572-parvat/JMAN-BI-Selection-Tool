#!/usr/bin/env python3
"""
Derive (and check) the result-confidence thresholds from data instead of guessing them.

    python scripts/calibrate_thresholds.py

Measures, on simulated clients, how stable a result is when the weights are nudged by +-1 (the size of disagreement we expect before the
weighting session settles them), and how reliable a partial ranking is. It then checks the constants in src/engine/engine.js
(TOO_CLOSE_Z, CLEAR_LEAD_Z) against those measurements.

RE-RUN AFTER THE WEIGHTING SESSION: stability depends on the weights, so the thresholds must be re-derived once they change.
Limits: the clients are uniformly random (real answers correlate), so treat the numbers as guidance for thresholds, not as probabilities
to show a user.
"""
import collections
import random
import re
import sys
from pathlib import Path

from bi_model import load_model, random_answers, score, visible_questions

m = load_model()
nulls = {q["id"]: [next(o["id"] for o in q["options"] if o["unknown"])] for q in m["questions"] if q.get("reference") == "neutral"}
src = Path("src/engine/engine.js").read_text(encoding="utf-8")
TOO_CLOSE = float(re.search(r"var TOO_CLOSE_Z = ([0-9.]+);", src).group(1))
CLEAR = float(re.search(r"var CLEAR_LEAD_Z = ([0-9.]+);", src).group(1))
NEAR = float(re.search(r"var NEAR_COMPLETE_COVERAGE = ([0-9.]+);", src).group(1))
BUCKETS = [(0, .05), (.05, .15), (.15, .3), (.3, .5), (.5, .75), (.75, 1.0), (1.0, 99)]
N, DRAWS, MIN_COUNTED = 1200, 30, 6


def perturbed(wr):
    return {q["id"]: min(5, max(0, q["weight"] + wr.choice([-1, 0, 1]))) for q in m["questions"] if q["id"] != "Q13"}


def stability(kind):
    """kind 'lead': margin of #1 over #2, stability of #1.  kind 'boundary': gap of 3rd over 4th, stability of the top-3 set."""
    rng, wr = random.Random(101 if kind == "lead" else 404), random.Random(202 if kind == "lead" else 505)
    by = collections.defaultdict(list)
    kept = 0
    for i in range(N):
        a = random_answers(m, rng, fixed=nulls if i % 2 else None)
        r = score(m, a)
        if len(r["counted"]) < MIN_COUNTED or len(r["ranked"]) < 4:
            continue
        kept += 1
        z, order = r["z"], r["ranked"]
        gap = r["margin"] if kind == "lead" else max(0.0, z[order[2]] - z[order[3]])
        base = order[0] if kind == "lead" else set(order[:3])
        same = 0
        for _ in range(DRAWS):
            o2 = score(m, a, perturbed(wr))["ranked"]
            same += (o2[0] == base) if kind == "lead" else (set(o2[:3]) == base)
        for b in BUCKETS:
            if b[0] <= gap < b[1]:
                by[b].append(same / DRAWS)
    return by, kept


def table(by, kept, title, what):
    print(title)
    print(f"   {'gap (z)':12} {'share of clients':>17} {what:>22}")
    for b in BUCKETS:
        n = len(by[b])
        if n:
            print(f"   {b[0]:>4}-{b[1] if b[1] < 99 else 'up':<6} {n / kept:>16.0%} {sum(by[b]) / n:>22.0%}   (n={n})")


def band(by, lo, hi):
    vals = [v for b in BUCKETS if lo <= b[0] and b[1] <= hi for v in by[b]]
    return sum(vals) / len(vals) if vals else float("nan")


lead, kl = stability("lead")
table(lead, kl, "A. Lead of #1 over #2: does #1 survive +-1 noise on every weight?", "#1 unchanged")
bound, kb = stability("boundary")
table(bound, kb, "\nB. Gap between 3rd and 4th: does the top-3 set survive the same noise?", "top-3 set unchanged")

rng = random.Random(303)
CB = [(0, .2), (.2, .4), (.4, .6), (.6, .8), (.8, 1.01)]
a1, a3 = collections.defaultdict(list), collections.defaultdict(list)
for i in range(500):
    final = random_answers(m, rng, fixed=nulls if i % 2 else None)
    rf = score(m, final)
    vis, _ = visible_questions(m, final)
    wt = {q["id"]: q["weight"] for q in vis}
    ids = [q["id"] for q in vis if q["id"] in final]
    tot = sum(wt.values()) or 1
    rng.shuffle(ids)
    part = {}
    for qid in ids:
        part[qid] = final[qid]
        r = score(m, part)
        if not r["counted"]:
            continue
        cov = sum(wt[x] for x in part if x in wt) / tot
        for b in CB:
            if b[0] <= cov < b[1]:
                a1[b].append(r["ranked"][0] == rf["ranked"][0])
                a3[b].append(set(r["ranked"][:3]) == set(rf["ranked"][:3]))
print("\nC. Does a partial ranking already match the final one? (answers revealed in random order)")
print(f"   {'share of visible weight answered':34} {'#1 matches final':>17} {'top-3 matches':>14}")
for b in CB:
    n = len(a1[b])
    if n:
        print(f"   {b[0]:.0%}-{min(b[1], 1.0):.0%}{'':26} {sum(a1[b]) / n:>17.0%} {sum(a3[b]) / n:>14.0%}   (n={n})")

print(f"\nConstants in src/engine/engine.js: TOO_CLOSE_Z = {TOO_CLOSE}, CLEAR_LEAD_Z = {CLEAR}, NEAR_COMPLETE_COVERAGE = {NEAR}")
too_close_stab = band(lead, 0, TOO_CLOSE)
narrow_stab = band(lead, TOO_CLOSE, CLEAR)
clear_stab = band(lead, CLEAR, 99)
print(f"  #1 stable below TOO_CLOSE_Z: {too_close_stab:.0%} | between: {narrow_stab:.0%} | at or above CLEAR_LEAD_Z: {clear_stab:.0%}")
bad = []
if clear_stab < 0.90:
    bad.append(f"a 'clear' lead is stable only {clear_stab:.0%} of the time (want at least 90%): raise CLEAR_LEAD_Z")
if too_close_stab > 0.80:
    bad.append(f"'too close' leads are stable {too_close_stab:.0%} of the time: TOO_CLOSE_Z is higher than the data needs")
if not too_close_stab < narrow_stab < clear_stab:
    bad.append("stability does not rise from too-close to narrow to clear: the bands are mis-ordered")
b_below, b_narrow, b_clear = band(bound, 0, TOO_CLOSE), band(bound, TOO_CLOSE, CLEAR), band(bound, CLEAR, 99)
print(f"  top-3 set stable below TOO_CLOSE_Z: {b_below:.0%} | between: {b_narrow:.0%} | at or above CLEAR_LEAD_Z: {b_clear:.0%}")
below_cov = [x for b in CB if b[1] <= NEAR + 1e-9 for x in a1[b]]
above_cov = [x for b in CB if b[0] >= NEAR - 1e-9 for x in a1[b]]
cov_below, cov_above = sum(below_cov) / len(below_cov), sum(above_cov) / len(above_cov)
print(f"  partial leader matches the final one: below NEAR_COMPLETE_COVERAGE {cov_below:.0%} | at or above {cov_above:.0%}")
if cov_above < 0.80:
    bad.append(f"at or above NEAR_COMPLETE_COVERAGE the partial leader matches the final one only {cov_above:.0%} (want at least 80%)")
if cov_below >= cov_above:
    bad.append("coverage does not improve agreement: NEAR_COMPLETE_COVERAGE is meaningless")
print("RESULT:", "constants are consistent with the data" if not bad else "; ".join(bad))
sys.exit(1 if bad else 0)
