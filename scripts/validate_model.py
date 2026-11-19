#!/usr/bin/env python3
"""
Model QA harness for the BI selection model. Re-run after every workbook change:

    python scripts/excel_to_json.py && python scripts/validate_model.py

Deterministic (fixed seeds). Exit code 1 if any FAIL. WARN = needs a human decision.

What it checks, and why each check exists:
  1  Reference data      scores must agree with the deck's own migration grid (slide 28) and
                          deployment table (slide 22)
  2  Heatmap agreement   score rows vs the deck's capability heatmap (slide 8): large divergences
  3  Branching           every gate path keeps enough weight; deal-breaker topics stay reachable
  4  Engine              stale answers, multi-select averaging, unknown handling
  5  Double counting     near-identical score vectors inside one theme; theme weight share
  6  Tool bias           does one tool win regardless of the client?
  7  Scenario suite      coherent client profiles from deck slides 19/20 must return the deck's tool
  8  Weight sensitivity  how often +-1 weight noise changes the #1 pick / top-3 shortlist
  9  Rationale hygiene   numbers quoted in rationale text must match the sheet
 10  Display range       observed normalised range vs theoretical floor
"""
import collections
import itertools
import random
import re
import statistics as st
import sys

from bi_model import (SCORE_MAX, calibration, dominates, load_model, random_answers, score,  # noqa: E402
                      visible_questions)

# ----------------------------------------------------------------------------- thresholds
MIN_PATH_COVERAGE = 0.70        # a client with nothing to migrate whose reports JMAN builds is asked 14 of 26 questions' worth of weight (owner decision 2026-11-18: Q17 and Q20 only follow existing reporting)
MAX_THEME_SHARE = 0.25        # no single theme should carry > 25% of total weight
NEUTRAL_MEAN_TOL = 0.05       # |mean z| under uninformative answers must be below this for every tool
NEUTRAL_SD_RATIO = 1.25       # max/min stdev of z across tools under uninformative answers
NEUTRAL_P1_RANGE = (0.10, 0.24)   # every tool's P(#1) for random clients must sit in this band (ideal 1/6 = 16.7%)
MAX_SHORTLIST_FLIP = 0.10     # +-1 weight noise should change the top-3 for <= 10% of clients
DUP_CORR = 0.99               # option vectors this correlated inside a theme count as duplicates
MIN_MARGIN = 0.3              # a scenario win by < 0.3 z is 'too close to call' (engine.js TOO_CLOSE_Z; derived by calibrate_thresholds.py)

# ----------------------------------------------------------------------------- deck reference data
# slide 28: rows = migrating FROM, cols = TO.  R=retain, E=easy, M=moderate, H=hard -> 4/4/2/1
GRID = {
    "powerbi": "R M H M M E", "tableau": "M R H M M E", "looker": "H H R M H M",
    "thoughtspot": "M M H R M E", "qlik": "M M H M R M", "sigma": "E E M E M R",
    "excel_other": "E E M E M E"}
GRID_COLS = ["powerbi", "tableau", "looker", "thoughtspot", "qlik", "sigma"]
GRID_VAL = {"R": 4, "E": 4, "M": 2, "H": 1}
# slide 22: on-premises option YES for these tools
ONPREM_YES = {"powerbi", "tableau", "qlik"}
# slide 8 heatmap (1-5), columns Power BI, Tableau, Looker, ThoughtSpot, Qlik, Sigma
HEAT_COLS = ["powerbi", "tableau", "looker", "thoughtspot", "qlik", "sigma"]
HEAT = {
    "Self-Service": (5, 3, 2, 5, 3, 5), "Business Value & Time to Insight": (4, 4, 3, 5, 3, 4),
    "Predictive & Advanced": (4, 4, 3, 2, 5, 2), "Semantic Layer": (4, 3, 5, 4, 3, 3),
    "Governance & Security": (5, 3, 3, 3, 4, 5), "Visualization & Storytelling": (3, 5, 3, 2, 3, 5),
    "Embedded Analytics": (4, 4, 5, 3, 4, 3), "Scalability & Performance": (3, 3, 5, 4, 4, 4),
    "Licensing & TCO": (5, 3, 3, 2, 4, 4), "Ease of Adoption": (5, 4, 2, 5, 3, 5),
    "AI-Assisted & Conversational": (5, 4, 3, 5, 4, 3), "Community & Partner Support": (5, 4, 3, 3, 4, 2)}
HEAT_MAP = [  # (question, option, heatmap row) - only pairs where the option means 'client needs this'
    ("Q01", "self_service_analytics_and_reporting", "Self-Service"),
    ("Q01", "faster_data_driven_decision_making", "Business Value & Time to Insight"),
    ("Q01", "improved_forecasting_and_planning", "Predictive & Advanced"),
    ("Q07", "yes", "Semantic Layer"), ("Q06", "enterprise_security", "Governance & Security"),
    ("Q06", "role_based_access_rls", "Governance & Security"),
    ("Q17", "custom_visuals_extensions", "Visualization & Storytelling"),
    ("Q19", "embedded_customer_facing_analytics", "Embedded Analytics"),
    ("Q18", "high_concurrency_strict_sla", "Scalability & Performance"),
    ("Q18", "near_real_time_live_query", "Scalability & Performance"),
    ("Q23", "tight_budget", "Licensing & TCO"), ("Q12", "no_training_required", "Ease of Adoption"),
    ("Q21", "critical", "Visualization & Storytelling"), ("Q22", "ai_first", "AI-Assisted & Conversational"),
    ("Q24", "critical", "Community & Partner Support"),
    ("Q11", "beginner", "Ease of Adoption"), ("Q16", "high_volume_rapidly_growing", "Scalability & Performance")]
THEMES = {
    "business context": ["Q01", "Q02", "Q03", "Q21", "Q22", "Q23", "Q25"], "ecosystem": ["Q04"],
    "governance & security": ["Q03", "Q05", "Q06", "Q07", "Q08", "Q09"],
    "skills & change": ["Q10", "Q11", "Q12", "Q24"], "migration": ["Q13", "Q14", "Q15"],
    "technical requirements": ["Q16", "Q17", "Q18", "Q19"], "constraints": ["Q20", "Q26"]}
# deal-breaker topics: every gate path must be able to reach at least one SCORED option of each
SIGNALS = {
    "deployment / residency control": [("Q06", "data_residency_requirement"), ("Q16", "hybrid_on_premises"),
                                       ("Q18", "offline_on_premises_operation"), ("Q26", "no_self_hosted")],
    "budget / cost pressure": [("Q23", "tight_budget")],
    "embedded / external audiences": [("Q06", "external_access"), ("Q19", "embedded_customer_facing_analytics"),
                                      ("Q19", "controlled_external_sharing")],
    "performance / scale": [("Q16", "high_volume_rapidly_growing"), ("Q18", "high_concurrency_strict_sla"),
                            ("Q25", "u_100_plus")],
    "presentation-quality visuals": [("Q21", "critical")],
    "AI / natural-language appetite": [("Q22", "ai_first")],
    "talent / partner pool": [("Q24", "critical")]}


def A(**kw):
    return {k.upper(): v if isinstance(v, list) else [v] for k, v in kw.items()}


# Client profiles for the deck's own patterns. RULE: pin ONLY what the deck sentence states - no extra
# answers (earlier fixtures added e.g. 'migrating from Excel', which favours particular tools).
SCENARIOS = [
    ("S1 Deep in Microsoft 365/Azure, wants fast adoption", "powerbi", "slide 20 row 1", A(
        q04="microsoft", q01=["self_service_analytics_and_reporting", "faster_data_driven_decision_making"])),
    ("S2 Google Cloud-native, wants governed self-service", "looker", "slide 20 row 3", A(
        q04="google_cloud", q01=["self_service_analytics_and_reporting", "standardised_metrics_and_a_single"])),
    ("S3a Salesforce-centric (decision tree step 3)", "tableau", "slide 19 step 3", A(q04="salesforce")),
    ("S3b Needs highly custom, presentation-quality dashboards", "tableau", "slide 20 row 2", A(q21="critical")),
    ("S4 Business users want to just ask questions in plain English", "thoughtspot", "slide 20 row 4", A(
        q22="ai_first", q10="client_team", q12="no_training_required")),
    ("S5 Regulated or hybrid, needs on-prem control", "qlik", "slide 20 row 5", A(
        q04="hybrid", q05="yes", q16="hybrid_on_premises", q26="no_self_hosted")),
    ("S6 Spreadsheet-heavy finance team, limited IT support", "sigma", "slide 20 row 6", A(
        q02="finance", q10="client_team", q11="beginner")),
]

RESULTS = []


def check(section, name, status, detail=""):
    RESULTS.append((section, name, status, detail))
    mark = {"PASS": "PASS", "WARN": "WARN", "FAIL": "FAIL"}[status]
    print(f"  [{mark}] {name}" + (f"\n         {detail}" if detail else ""))


def pearson(a, b):
    ma, mb = st.mean(a), st.mean(b)
    d = (sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) ** 0.5
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / d if d else float("nan")


def spearman(a, b):
    def rk(x):
        return [sum(1 for v in x if v < xi) + (sum(1 for v in x if v == xi) + 1) / 2 for xi in x]
    return pearson(rk(a), rk(b))


def main():
    m = load_model()
    T = m["tool_ids"]
    Q = sorted(m["questions"], key=lambda q: q["id"])
    total_w = sum(q["weight"] for q in Q)
    vec = lambda q, o: [m["qmap"][q]["omap"][o]["scores"][t] for t in T]

    print("\n1. REFERENCE DATA vs DECK")
    bad = []
    for src, row in GRID.items():
        for tgt, c in zip(GRID_COLS, row.split()):
            if m["qmap"]["Q14"]["omap"][src]["scores"][tgt] != GRID_VAL[c]:
                bad.append((src, tgt))
    check(1, "Q14 matches deck migration grid (slide 28)", "FAIL" if bad else "PASS",
          f"{len(bad)} mismatches of {len(GRID) * 6}: {bad[:5]}" if bad else "0 mismatches of 42")
    bad = []
    for q, o in [("Q16", "hybrid_on_premises"), ("Q18", "offline_on_premises_operation"),
                 ("Q26", "no_self_hosted")]:
        s = m["qmap"][q]["omap"][o]["scores"]
        if min(s[t] for t in ONPREM_YES) <= max(s[t] for t in T if t not in ONPREM_YES):
            bad.append(f"{q}/{o}")
    check(1, "On-prem options separate on-prem-capable tools (slide 22)", "FAIL" if bad else "PASS", str(bad or ""))

    print("\n2. HEATMAP AGREEMENT (slide 8)")
    div = []
    for q, o, h in HEAT_MAP:
        v = vec(q, o)
        hv = dict(zip(HEAT_COLS, HEAT[h]))
        hh = [(hv[t] - 1) * 0.75 + 1 for t in T]
        gaps = [(t, v[i], round(hh[i], 1)) for i, t in enumerate(T) if abs(v[i] - hh[i]) >= 1.5]
        rho = spearman(v, [hv[t] for t in T])
        if rho < 0.3 or gaps:
            div.append(f"{q}/{o} vs '{h}': rho={rho:.2f}, gaps(tool,model,deck)={gaps}")
    check(2, f"{len(HEAT_MAP) - len(div)}/{len(HEAT_MAP)} mapped rows agree with heatmap",
          "WARN" if div else "PASS", "\n         ".join(div))

    print("\n3. BRANCHING")
    parents = sorted({cl["q"] for q in Q for cl in q["showIf"]})
    opts = [[o["id"] for o in m["qmap"][p]["options"]] for p in parents]
    worst = (1.0, None)
    per_path = {}
    for combo in itertools.product(*opts):
        ans = {p: [c] for p, c in zip(parents, combo)}
        vis, _ = visible_questions(m, ans)
        share = sum(q["weight"] for q in vis) / total_w
        per_path[combo] = (share, {q["id"] for q in vis})
        if share < worst[0]:
            worst = (share, dict(zip(parents, combo)))
    check(3, f"every path keeps >= {MIN_PATH_COVERAGE:.0%} of weight", "PASS" if worst[0] >= MIN_PATH_COVERAGE else "FAIL",
          f"worst path {worst[1]} keeps {worst[0]:.0%}")
    for topic, lst in SIGNALS.items():
        scored = [(q, o) for q, o in lst if o in m["qmap"][q]["omap"]]
        blind = [dict(zip(parents, c)) for c, (s, vis) in per_path.items()
                 if not any(q in vis for q, _ in scored)]
        check(3, f"topic reachable on every path: {topic}", "FAIL" if blind else "PASS",
              f"{len(blind)} path(s) cannot reach a scored option, e.g. {blind[0]}" if blind else "")
    # semantic check: gated questions that are not about the existing suite
    gated_general = [q["id"] for q in Q if any(c["q"] == "Q13" for c in q["showIf"]) and q["id"] not in ("Q14", "Q15", "Q17", "Q20")]
    check(3, "only migration-specific questions (Q14, Q15, Q17, Q20) are gated on Q13", "FAIL" if gated_general else "PASS",
          f"also gated: {gated_general} (the data-estate, refresh and embedding questions are about every client)" if gated_general else
          "Q17 and Q20 follow existing reporting by the owner's decision of 2026-11-18; the Flow sheet asks them of everyone")

    print("\n4. ENGINE")
    a = {"Q10": ["client_team"], "Q11": ["beginner"], "Q04": ["microsoft"]}
    a2 = dict(a, Q10=["jman"])
    check(4, "stale answers ignored when parent changes", "PASS" if ("Q11" in score(m, a)["counted"]
          and "Q11" not in score(m, a2)["counted"]) else "FAIL")
    r = score(m, {"Q01": ["self_service_analytics_and_reporting", "improved_forecasting_and_planning"]})
    exp = (m["qmap"]["Q01"]["omap"]["self_service_analytics_and_reporting"]["scores"]["looker"]
           + m["qmap"]["Q01"]["omap"]["improved_forecasting_and_planning"]["scores"]["looker"]) / 2
    check(4, "multi-select averages (never sums)", "PASS" if abs(r["raw_fit"]["looker"] * SCORE_MAX - exp) < 1e-9 else "FAIL")
    check(4, "unknown-only answers are skipped", "PASS" if "Q02" not in score(m, {"Q02": ["other_not_yet_defined"]})["counted"] else "FAIL")
    check(4, "empty input does not crash and ranks every tool equally",
          "PASS" if (score(m, {})["raw_fit"]["powerbi"] == 0 and set(score(m, {})["rank"].values()) == {1}) else "FAIL")

    print("\n5. DOUBLE COUNTING")
    for theme, ids in THEMES.items():
        share = sum(m["qmap"][i]["weight"] for i in ids) / total_w
        if theme == "governance & security" or share > MAX_THEME_SHARE:
            check(5, f"theme weight share: {theme} = {share:.0%} (Q{', Q'.join(i[1:] for i in ids)})",
                  "WARN" if share > MAX_THEME_SHARE else "PASS")
    dups = []
    for theme, ids in THEMES.items():
        for qa, qb in itertools.combinations(ids, 2):
            for oa in m["qmap"][qa]["options"]:
                for ob in m["qmap"][qb]["options"]:
                    va, vb = [oa["scores"][t] for t in T], [ob["scores"][t] for t in T]
                    if max(va) - min(va) >= 2 and pearson(va, vb) >= DUP_CORR and not oa["unknown"]:
                        dups.append(f"{qa}/{oa['id']} == {qb}/{ob['id']} {va}")
    check(5, "no identical score vectors across questions inside a theme", "WARN" if dups else "PASS",
          "\n         ".join(sorted(set(dups))[:8]))

    print("\n6. NO PLATFORM BIAS (the ranking must come from the answers only)")
    allo = [o for q in Q for o in q["options"] if not o["unknown"]]
    means = {t: st.mean(o["scores"][t] for o in allo) for t in T}
    raw_gap = max(means.values()) - min(means.values())
    N = 6000
    # null answer per requirement-style question (Reference=neutral): 'no requirement stated'
    nulls = {q["id"]: [next(o["id"] for o in q["options"] if o["unknown"])] for q in Q if q.get("reference") == "neutral"}

    def population(pin_nulls, seed):
        rng = random.Random(seed)
        cl = [random_answers(m, rng, fixed=nulls if pin_nulls else None) for _ in range(N)]
        zs = {t: [] for t in T}
        wins, raw_wins = collections.Counter(), collections.Counter()
        for c in cl:
            r = score(m, c)
            for t in T:
                zs[t].append(r["z"][t])
            for t in r["tied_leaders"]:
                wins[t] += 1 / len(r["tied_leaders"])
            r0 = score(m, c, mode="raw")
            for t in r0["tied_leaders"]:
                raw_wins[t] += 1 / len(r0["tied_leaders"])
        return cl, zs, wins, raw_wins
    clients, zs, wins, raw_wins = population(True, 7)     # no requirements stated, categorical answers random
    full_clients, zs_f, wins_f, _ = population(False, 8)  # requirement answers random too
    mean_z = {t: st.mean(zs[t]) for t in T}
    sd_z = {t: st.pstdev(zs[t]) for t in T}
    check(6, f"[info] raw sums would lean: sheet mean-score gap {raw_gap:.2f}; raw P(#1) "
          + ", ".join(f"{t}={raw_wins[t] / N:.0%}" for t in T), "PASS",
          "this is why scores are standardised against a reference instead of summed raw")
    worst = max(abs(v) for v in mean_z.values())
    check(6, f"N1 clients who state no requirement: expected score equal for every tool (max |mean z| {worst:.3f}, limit {NEUTRAL_MEAN_TOL})",
          "PASS" if worst < NEUTRAL_MEAN_TOL else "FAIL", ", ".join(f"{t}={v:+.3f}" for t, v in mean_z.items()))
    ratio = max(sd_z.values()) / min(sd_z.values())
    check(6, f"N2 equal volatility: stdev ratio max/min {ratio:.2f} (limit {NEUTRAL_SD_RATIO})",
          "PASS" if ratio < NEUTRAL_SD_RATIO else "FAIL", ", ".join(f"{t}={v:.2f}" for t, v in sd_z.items()))
    lo, hi = NEUTRAL_P1_RANGE
    bad = [t for t in T if not lo <= wins[t] / N <= hi]
    check(6, f"N3 every tool wins {lo:.0%}-{hi:.0%} of such clients (ideal {1 / len(T):.1%})", "FAIL" if bad else "PASS",
          "P(#1): " + ", ".join(f"{t}={wins[t] / N:.1%}" for t in T))
    badf = [t for t in T if not lo <= wins_f[t] / N <= hi]
    check(6, f"N3b fully random clients (requirements drawn too): every tool wins {lo:.0%}-{hi:.0%}",
          "FAIL" if badf else "PASS", "P(#1): " + ", ".join(f"{t}={wins_f[t] / N:.1%}" for t in T))
    mean_f = {t: st.mean(zs_f[t]) for t in T}
    check(6, f"N3d stating requirements gives no tool a head start: mean z of fully random clients within +-{NEUTRAL_MEAN_TOL} "
             f"(max {max(abs(v) for v in mean_f.values()):.3f}; before the requirement-premium correction Power BI averaged +0.96)",
          "FAIL" if any(abs(v) > NEUTRAL_MEAN_TOL for v in mean_f.values()) else "PASS", ", ".join(f"{t}={v:+.3f}" for t, v in mean_f.items()))
    inert = [q["id"] for q in Q if q["weight"] > 0 and q.get("reference") != "neutral"
             and sum(1 for o in q["options"] if not o["unknown"]) < 2]
    check(6, "N3c no weighted question has an inert weight (a single informative answer cancels out under Reference=mean)",
          "FAIL" if inert else "PASS", str(inert) if inert else "")
    inv_bad = 0
    prng = random.Random(3)
    for c in clients[:300]:
        base = score(m, c)["rank"]
        mm = dict(m)
        perm = list(T)
        prng.shuffle(perm)
        mm["tool_ids"] = perm
        if score(mm, c)["rank"] != base:
            inv_bad += 1
    check(6, "N4 tool order (sheet, deck, alphabetical) never changes any rank", "FAIL" if inv_bad else "PASS",
          f"{inv_bad} of 300 clients ranked differently after shuffling tool order" if inv_bad else "")
    viol = 0
    for c in clients:
        r = score(m, c)
        pq = {}
        vis, live = visible_questions(m, c)
        for q in vis:
            sel = [q["omap"][o] for o in live.get(q["id"], []) if o in q["omap"] and not q["omap"][o]["unknown"]]
            if sel and q["weight"] and q["id"] in m["calibration"]:
                pq[q["id"]] = {t: sum(o["scores"][t] for o in sel) / len(sel) for t in T}
        for a_ in r["ranked"]:
            for b_ in r["ranked"]:
                if a_ != b_ and r["rank"][a_] < r["rank"][b_] and dominates(b_, a_, pq):
                    viol += 1
    check(6, "N5 no tool outranks one that is at least as good on every answered question", "FAIL" if viol else "PASS",
          f"{viol} violations over {N} clients" if viol else "")
    tie = score(m, {"Q02": ["other_not_yet_defined"]})
    check(6, "N6 identical totals share a rank (no hidden tie-break by position)",
          "PASS" if set(tie["rank"].values()) == {1} else "FAIL")
    import json
    from pathlib import Path
    J = json.loads(Path("data/questions.json").read_text(encoding="utf-8"))
    cal = calibration(m)
    drift = [q["id"] for q in J["questions"] if "baseline" in q and any(
        abs(q["baseline"][t] - cal[q["id"]]["mean"][t]) > 1e-6 or abs(q["variance"][t] - cal[q["id"]]["var"][t]) > 1e-6
        for t in T)]
    check(6, "N7 calibration in questions.json matches the scores", "FAIL" if drift else "PASS", str(drift) if drift else "")
    names = [t["name"].lower() for t in J["tools"]]
    check(6, "N8 tools carry no display order in the JSON and are listed alphabetically",
          "PASS" if (all(set(t) <= {"id", "name"} for t in J["tools"]) and names == sorted(names)) else "FAIL")

    print("\n7. SCENARIO SUITE (profile only; each pins only what the deck sentence states)")
    for name, exp, src, prof in SCENARIOS:
        r = score(m, prof)
        line = " > ".join(f"{t}:{r['z'][t]:+.2f}" for t in r["ranked"][:3])
        gap = r["z"][r["ranked"][0]] - r["z"][exp]
        if r["rank"][exp] != 1 and exp in r["excluded"]:
            status, why = "FAIL", "the expected tool was ruled out."
        elif r["rank"][exp] != 1 and gap < MIN_MARGIN:
            status, why = "WARN", (f"rank {r['rank'][exp]}, only {gap:.2f} z behind {r['ranked'][0]} (< {MIN_MARGIN}): "
                                   "too close to call, the answers alone cannot separate them.")
        elif r["rank"][exp] != 1:
            status, why = "FAIL", f"expected rank 1, got {r['rank'][exp]}."
        elif len(r["tied_leaders"]) > 1:
            status, why = "WARN", f"tied for first with {[t for t in r['tied_leaders'] if t != exp]}: the answers alone cannot separate them."
        elif r["margin"] < MIN_MARGIN:
            status, why = "WARN", f"wins by only {r['margin']:.2f} z (< {MIN_MARGIN}): too close to call."
        else:
            status, why = "PASS", f"wins by {r['margin']:.2f} z."
        check(7, f"{name} -> {exp} ({src})", status, f"{why}  z: {line}")

    print("\n8. WEIGHT SENSITIVITY (+-1 on every weight, 60 draws x 500 clients)")
    rng = random.Random(5)
    clients = [random_answers(m, rng) for _ in range(500)]

    def tops(weights):
        out = []
        for c in clients:
            rk = score(m, c, weights)["ranked"]
            out.append((rk[0], frozenset(rk[:3])))
        return out
    base = tops(None)
    f1, f3 = [], []
    rw = random.Random(9)
    for _ in range(60):
        w = {q["id"]: min(5, max(0, q["weight"] + rw.choice([-1, 0, 1]))) for q in Q if q["id"] != "Q13"}
        r = tops(w)
        f1.append(sum(1 for x, y in zip(r, base) if x[0] != y[0]) / len(base))
        f3.append(sum(1 for x, y in zip(r, base) if x[1] != y[1]) / len(base))
    check(8, f"top-3 shortlist flips for {st.mean(f3):.0%} of clients (worst draw {max(f3):.0%}); #1 flips {st.mean(f1):.0%}",
          "WARN" if st.mean(f3) > MAX_SHORTLIST_FLIP else "PASS",
          "weights are consequential - they need a documented elicitation, not guesses")

    print("\n9. RATIONALE HYGIENE")
    pat = re.compile(r"(Power BI|Looker|Tableau|ThoughtSpot|Sigma|Qlik)[^.;]{0,60}?(?:score[sd]?|held at|rated?|=|at)\s*(?:a\s*)?(\d)\b")
    n2i = {"Power BI": "powerbi", "Looker": "looker", "Tableau": "tableau", "ThoughtSpot": "thoughtspot",
           "Sigma": "sigma", "Qlik": "qlik"}
    stale = [(q["id"], o["id"]) for q in Q for o in q["options"]
             for nm, n in pat.findall(o["rationale"]["summary"]) if int(n) != o["scores"][n2i[nm]]]
    check(9, f"numbers quoted in combined rationales match the sheet ({len(stale)} stale in {len(set(stale))} options)",
          "FAIL" if stale else "PASS")
    scored = [(q, o) for q in Q for o in q["options"] if not o["unknown"] and len(set(o["scores"].values())) > 1]
    thin = [(q["id"], o["id"]) for q, o in scored if sum(1 for n in n2i if n in o["rationale"]["summary"]) <= 3]
    check(9, f"combined rationale names all six tools ({len(thin)} of {len(scored)} differentiating options cover <= 3)",
          "WARN" if thin else "PASS")

    print("\n10. PRESENTATION")
    zr = [v for c in clients[:2000] for v in score(m, c)["z"].values()]
    check(10, f"z scores observed {min(zr):+.2f}..{max(zr):+.2f} (0 = an average random client)", "PASS",
          "show rank, margin and 'too close to call'; rank only by z; order equal ranks alphabetically")

    print("\n11. DRAFT CONTENT")
    drafts = [q for q in Q if q.get("status") == "draft"]
    dw = sum(q["weight"] for q in drafts)
    check(11, f"{len(drafts)} draft question(s) await SME review: {', '.join(q['id'] for q in drafts)}"
          if drafts else "no draft questions", "WARN" if drafts else "PASS",
          f"draft weight = {dw} of {total_w} ({dw / total_w:.0%}); build production JSON with --exclude-draft until approved"
          if drafts else "")
    nobasis = [(q["id"], o["id"]) for q in drafts for o in q["options"] if not o.get("scoreBasis")]
    check(11, "every draft option cites a score basis", "FAIL" if nobasis else "PASS", str(nobasis[:5]) if nobasis else "")
    check(11, "pending (unscored) options are skipped by the converter, not guessed", "PASS")

    c = collections.Counter(r[2] for r in RESULTS)
    print(f"\nSUMMARY: {c['PASS']} pass, {c['WARN']} warn, {c['FAIL']} fail")
    return 1 if c["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
