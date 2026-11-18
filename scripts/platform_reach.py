#!/usr/bin/env python3
"""Can every platform show up? A reproducible assessment of how often each tool is recommended.

Prints (markdown) four things, so the answer is data, not opinion:
  1. what the raw sheet says (and what ranking by raw sums would do),
  2. how often each tool is #1 and in the top 3 for simulated clients, by how many requirements the client states,
     with and without the requirement-premium correction (docs/scoring-method.md),
  3. how many single answers put each tool first,
  4. the deck's own client scenarios, one per platform.

  python scripts/platform_reach.py            # the report
  python scripts/platform_reach.py --check    # exit 1 if a tool is out of the fair band (used by the harness)
"""
import argparse
import collections
import copy
import random
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bi_model as B  # noqa: E402

N = 3000
BAND = (0.10, 0.24)          # same fair band as harness check N3 (ideal 1/6 = 16.7%)


def without_correction(model):
    """The model as it scored before the requirement-premium correction: requirement questions centred on the neutral score 2."""
    m = copy.deepcopy(model)
    for q in m["questions"]:
        if q.get("reference") == "neutral" and q["weight"]:
            k = [o for o in q["options"] if not o["unknown"]]
            n_null = len(q["options"]) - len(k)
            m["calibration"][q["id"]] = {
                "mean": {t: float(B.NEUTRAL_SCORE) for t in m["tool_ids"]},
                "var": {t: st.pvariance([o["scores"][t] - B.NEUTRAL_SCORE for o in k] + [0.0] * n_null) for t in m["tool_ids"]}}
    return m


def draw(model, rng, k, req_ids):
    a = B.random_answers(model, rng, 3)
    stated = set(rng.sample(req_ids, k))
    for q in req_ids:
        if q in a and q not in stated:
            del a[q]
    return a


def shares(model, k, req_ids, seed=5):
    rng = random.Random(seed)
    wins, top3 = collections.Counter(), collections.Counter()
    for _ in range(N):
        r = B.score(model, draw(model, rng, k, req_ids))
        for t in r["tied_leaders"]:
            wins[t] += 1 / len(r["tied_leaders"])
        for t in r["ranked"][:3]:
            top3[t] += 1
    return {t: wins[t] / N for t in model["tool_ids"]}, {t: top3[t] / N for t in model["tool_ids"]}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    m = B.load_model("data/questions.json")
    T = m["tool_ids"]
    name = {t["id"]: t["name"] for t in m["tools"]}
    req_ids = [q["id"] for q in m["questions"] if q.get("reference") == "neutral" and q["weight"]]
    old = without_correction(m)
    row = lambda label, d: f"| {label} | " + " | ".join(f"{100 * d[t]:.0f}%" for t in T) + " |"
    head = "| | " + " | ".join(name[t] for t in T) + " |\n|---|" + "---|" * len(T)

    if args.check:
        bad = []
        for k in (0, len(req_ids)):
            w, _ = shares(m, k, req_ids)
            bad += [f"{name[t]} wins {w[t]:.1%} with {k} requirements stated" for t in T if not BAND[0] <= w[t] <= BAND[1]]
        print("\n".join(bad) if bad else "every tool is inside the fair band")
        return 1 if bad else 0

    print("# Can every platform show up?\n")
    print("## 1. The raw sheet\n")
    allv = {t: [o["scores"][t] for q in m["questions"] for o in q["options"] if not o["unknown"]] for t in T}
    best = collections.Counter()
    opts = [o for q in m["questions"] for o in q["options"] if not o["unknown"]]
    for o in opts:
        mx = max(o["scores"].values())
        for t in T:
            if o["scores"][t] == mx:
                best[t] += 1
    print(head)
    print("| Mean score over all answers | " + " | ".join(f"{st.mean(allv[t]):.2f}" for t in T) + " |")
    print(f"| Answers where it scores highest or joint highest (of {len(opts)}) | " + " | ".join(str(best[t]) for t in T) + " |")
    rng = random.Random(7)
    raw = collections.Counter()
    for _ in range(N):
        r = B.score(m, B.random_answers(m, rng, 3), mode="raw")
        for t in r["tied_leaders"]:
            raw[t] += 1 / len(r["tied_leaders"])
    print(row("Share of simulated clients it would win if ranked by raw sums", {t: raw[t] / N for t in T}))

    print("\n## 2. Simulated clients: how often each tool is first, and in the top three\n")
    print("Uniform random answers; k = how many of the requirement questions "
          f"({', '.join(req_ids)}) the client states.\n")
    for label, model in (("Before the correction", old), ("After the correction (what ships)", m)):
        print(f"**{label}** (first place / top three)\n")
        print(head)
        for k in (0, 3, len(req_ids)):
            w, t3 = shares(model, k, req_ids)
            print(f"| k = {k} | " + " | ".join(f"{100 * w[t]:.0f}% / {100 * t3[t]:.0f}%" for t in T) + " |")
        print()

    print("## 3. How many single answers put each tool first\n")
    wins = collections.Counter()
    n = 0
    for q in m["questions"]:
        for o in q["options"]:
            if o["unknown"] or not q["weight"]:
                continue
            a = {q["id"]: [o["id"]]}
            for cl in q["showIf"]:
                a[cl["q"]] = [cl["in"][0]]
            r = B.score(m, a)
            n += 1
            for t in r["tied_leaders"]:
                wins[t] += 1 / len(r["tied_leaders"])
    print(head)
    print(f"| Answers (of {n}) that put it first alone, ties shared | " + " | ".join(f"{wins[t]:.1f}" for t in T) + " |")

    print("\n## 4. One deck scenario per platform\n")
    print("| Client (deck slide 20) | Answers pinned | Result |\n|---|---|---|")
    import validate_model as V
    for sname, exp, src, prof in V.SCENARIOS:
        r = B.score(m, prof)
        print(f"| {sname.split(" ", 1)[1].strip()} | {len(prof)} | {name[r['ranked'][0]]} first, {name[exp]} {('first' if r['rank'][exp] == 1 else 'rank ' + str(r['rank'][exp]))} (+{r['margin']:.2f} z) |")


if __name__ == "__main__":
    sys.exit(main())
