#!/usr/bin/env python3
"""
Write tests/fixtures/parity.json: inputs and the EXACT outputs of the Python reference engine, so the JavaScript engine
can be tested against it (tests/parity.test.js). Regenerate whenever data/questions.json or bi_model.py changes:

    python scripts/excel_to_json.py && python scripts/make_parity_fixtures.py

The fixture records the SHA-256 of questions.json; the JS test refuses to run against a stale fixture.
"""
import hashlib
import json
import random
import sys
from pathlib import Path

from bi_model import load_model, random_answers, score
import validate_model as V

MODEL = Path("data/questions.json")
OUT = Path("tests/fixtures/parity.json")
N_RANDOM = 150
N_WEIGHTED = 30


def case(name, answers, weights=None, mode="neutral"):
    r = score(m, answers, weights, mode)
    return {
        "name": name, "answers": answers, "weights": weights or {}, "mode": mode,
        "expect": {
            "z": r["z"], "rawFit": r["raw_fit"], "rank": r["rank"], "ranked": r["ranked"], "excluded": r["excluded"],
            "counted": r["counted"], "denominator": r["denominator"], "margin": r["margin"],
            "tiedLeaders": r["tied_leaders"], "visible": r["visible"],
        },
    }


m = load_model(str(MODEL))
cases = []
for name, exp, src, prof in V.SCENARIOS:
    cases.append(case("scenario: " + name, prof))
cases += [
    case("empty answers", {}),
    case("unknown-only answer", {"Q02": ["other_not_yet_defined"]}),
    case("weight-0 gate only", {"Q13": ["yes"]}),
    case("stale answer: Q11 under JMAN build is ignored", {"Q10": ["jman"], "Q11": ["beginner"], "Q12": ["no_training_required"], "Q04": ["microsoft"]}),
    case("same answers, client builds: Q11/Q12 count", {"Q10": ["client_team"], "Q11": ["beginner"], "Q12": ["no_training_required"], "Q04": ["microsoft"]}),
    case("exclude: self-hosted removes Sigma", {"Q26": ["no_self_hosted"], "Q04": ["snowflake"]}),
    case("multi-select averages", {"Q01": ["self_service_analytics_and_reporting", "improved_forecasting_and_planning"]}),
    case("multi-select with an unknown option", {"Q01": ["other_not_yet_defined", "faster_data_driven_decision_making"]}),
    case("unanswered requirement question stays out", {"Q04": ["google_cloud"], "Q21": ["not_a_priority"]}),
    case("override weights", {"Q04": ["salesforce"], "Q05": ["yes"], "Q06": ["enterprise_security"]}, {"Q04": 1, "Q05": 5, "Q06": 5}),
    case("override weight to zero", {"Q04": ["salesforce"], "Q05": ["yes"]}, {"Q04": 0}),
    case("raw mode (explanation only)", {"Q04": ["microsoft"], "Q05": ["yes"], "Q22": ["ai_first"]}, mode="raw"),
    case("ids that do not exist are ignored", {"Q04": ["microsoft", "no_such_option"], "Q99": ["x"]}),
]
nulls = {q["id"]: [next(o["id"] for o in q["options"] if o["unknown"])] for q in m["questions"] if q.get("reference") == "neutral"}
rng = random.Random(2026)
for i in range(N_RANDOM):
    pin = i % 2 == 0
    cases.append(case(f"random #{i}{' (no requirements)' if pin else ''}", random_answers(m, rng, fixed=nulls if pin else None)))
wr = random.Random(7)
for i in range(N_WEIGHTED):
    w = {q["id"]: min(5, max(0, q["weight"] + wr.choice([-2, -1, 0, 1, 2]))) for q in m["questions"]}
    cases.append(case(f"random weights #{i}", random_answers(m, rng), w))

blob = {"modelSha256": hashlib.sha256(MODEL.read_bytes()).hexdigest(), "cases": cases}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(blob, separators=(",", ":")) + "\n", encoding="utf-8")
ties = sum(1 for c in cases if len(c["expect"]["tiedLeaders"]) > 1)
print(f"wrote {OUT} - {len(cases)} cases ({ties} with tied leaders), {OUT.stat().st_size // 1024} KB")
