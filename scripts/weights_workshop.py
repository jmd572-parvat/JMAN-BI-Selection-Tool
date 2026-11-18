#!/usr/bin/env python3
"""
Swing-weighting workshop tooling.

  python scripts/weights_workshop.py init [--out data/weighting/ratings-template.csv]
      One blank rating sheet per participant is made by copying this template (see docs/weighting-workshop.md).

  python scripts/weights_workshop.py aggregate [data/weighting/ratings] [--out data/weighting/weights-proposal.csv]
      Reads every *.csv in the folder, converts the ratings into 0-5 weights, flags disagreement,
      checks theme concentration, and previews what the new weights would do to the deck scenarios
      and to the shortlist. It NEVER edits the workbook: weights are entered by hand after sign-off.

Conversion rule (documented so it can be defended):
  each participant gives the question whose swing matters most the rating 100 and rates the others 0-100;
  group value = MEDIAN of participants (robust to one outlier);   weight = round(median / 20), clamped 0-5.
  Q13 is a gate (weight 0 by design) and is excluded from rating.
"""
import argparse
import csv
import random
import statistics as st
import sys
from pathlib import Path

from bi_model import load_model, random_answers, score
import validate_model as V

GATE_ONLY = {"Q13"}
DISAGREE_IQR = 25          # IQR above this on the 0-100 scale means the group has not converged
DISAGREE_RANGE = 50


def cmd_init(a):
    m = load_model(a.model)
    sections = {s["id"]: s["title"] for s in m["sections"]}
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["question_id", "order", "section", "question", "status", "rating_0_100", "comment"])
        for q in m["questions"]:
            if q["id"] in GATE_ONLY:
                continue
            w.writerow([q["id"], q["order"], sections.get(q["section"], q["section"]), q["text"], q["status"], "", ""])
    print(f"wrote {out} - {len(m['questions']) - len(GATE_ONLY)} questions to rate")
    print("NOTE: current weights are deliberately NOT shown, so participants are not anchored.")


def quartiles(xs):
    if len(xs) < 2:
        return xs[0], xs[0]
    q = st.quantiles(xs, n=4, method="inclusive")
    return q[0], q[2]


def cmd_aggregate(a):
    m = load_model(a.model)
    files = sorted(Path(a.folder).glob("*.csv"))
    if not files:
        sys.exit(f"no .csv files in {a.folder}")
    ratings, problems = {}, []
    for f in files:
        rows = list(csv.DictReader(f.open(encoding="utf-8-sig")))
        vals = {}
        for r in rows:
            raw = (r["rating_0_100"] or "").strip()
            if not raw:
                problems.append(f"{f.name}: {r['question_id']} left blank")
                continue
            try:
                v = float(raw)
            except ValueError:
                problems.append(f"{f.name}: {r['question_id']} rating {raw!r} is not a number")
                continue
            if not 0 <= v <= 100:
                problems.append(f"{f.name}: {r['question_id']} rating {v} outside 0-100")
                continue
            vals[r["question_id"]] = v
        if vals and max(vals.values()) < 100:
            problems.append(f"{f.name}: no question was rated 100 (the biggest swing must anchor the scale)")
        for qid, v in vals.items():
            ratings.setdefault(qid, []).append(v)
    for p in problems:
        print(f"WARN  {p}")
    print(f"\n{len(files)} participant file(s)\n")
    print(f"{'Q':4} {'now':>3} {'new':>3} {'delta':>5}  {'median':>6} {'mean':>5} {'IQR':>4} {'min-max':>9}  note")
    rows_out, new_w = [], {}
    for q in m["questions"]:
        qid = q["id"]
        if qid in GATE_ONLY:
            new_w[qid] = q["weight"]
            continue
        xs = ratings.get(qid)
        if not xs:
            print(f"{qid:4} {q['weight']:>3}   -   no ratings")
            new_w[qid] = q["weight"]
            continue
        med = st.median(xs)
        q1, q3 = quartiles(xs)
        w = max(0, min(5, int(med / 20 + 0.5)))
        new_w[qid] = w
        note = []
        if len(xs) >= 3 and (q3 - q1 > DISAGREE_IQR or max(xs) - min(xs) > DISAGREE_RANGE):
            note.append("DISCUSS: no convergence")
        if len(xs) < len(files):
            note.append(f"only {len(xs)}/{len(files)} rated")
        print(f"{qid:4} {q['weight']:>3} {w:>3} {w - q['weight']:>+5}  {med:>6.0f} {st.mean(xs):>5.0f} {q3 - q1:>4.0f} {min(xs):>4.0f}-{max(xs):<4.0f}  {'; '.join(note)}")
        rows_out.append([qid, q["text"], q["weight"], w, round(med, 1), round(st.mean(xs), 1), round(q3 - q1, 1),
                         min(xs), max(xs), len(xs), "; ".join(note)])
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["question_id", "question", "current_weight", "proposed_weight", "median", "mean", "iqr", "min", "max", "n", "note"])
        w.writerows(rows_out)
    print(f"\nwrote {out}")

    # ---- concentration check
    total = sum(new_w.values())
    print("\nTheme concentration under the proposed weights (limit %.0f%%):" % (V.MAX_THEME_SHARE * 100))
    for theme, ids in V.THEMES.items():
        share = sum(new_w.get(i, 0) for i in ids) / total if total else 0
        print(f"  {theme:24} {share:5.0%} {'  <-- over the limit' if share > V.MAX_THEME_SHARE else ''}")

    # ---- impact preview
    print("\nScenario suite under the PROPOSED weights vs CURRENT weights (profile only):")
    for name, exp, src, prof in V.SCENARIOS:
        r0, r1 = score(m, prof), score(m, prof, new_w)
        k0, k1 = r0["ranked"].index(exp) + 1, r1["ranked"].index(exp) + 1
        print(f"  {name[:58]:58} rank of {exp:11}: now {k0} -> proposed {k1}")
    rng = random.Random(1)
    clients = [random_answers(m, rng) for _ in range(1500)]
    f1 = f3 = 0
    for c in clients:
        a0, a1 = score(m, c)["ranked"], score(m, c, new_w)["ranked"]
        f1 += a0[0] != a1[0]
        f3 += set(a0[:3]) != set(a1[:3])
    print(f"\nChange vs current weights over {len(clients)} random clients: #1 differs for {f1 / len(clients):.0%}, "
          f"top-3 set differs for {f3 / len(clients):.0%}")
    print("\nNext: review DISCUSS rows (run round 2 on those only), get sign-off, enter the weights in the workbook, "
          "then python scripts/excel_to_json.py && python scripts/validate_model.py")
    print("Do NOT adjust ratings to make a scenario pass: scenarios are tests, not targets.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="data/questions.json")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("init")
    p.add_argument("--out", default="data/weighting/ratings-template.csv")
    p = sub.add_parser("aggregate")
    p.add_argument("folder", nargs="?", default="data/weighting/ratings")
    p.add_argument("--out", default="data/weighting/weights-proposal.csv")
    a = ap.parse_args()
    {"init": cmd_init, "aggregate": cmd_aggregate}[a.cmd](a)


if __name__ == "__main__":
    main()
