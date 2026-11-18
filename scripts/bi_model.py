"""
Reference implementation of the selection model (the executable specification: the JavaScript engine
must reproduce its results). Pure standard library.

DESIGN GOAL: NO PLATFORM BIAS. The ranking must move only with the client's answers.
Formally, a client who gives NO information (every answer equally likely) must see every platform with
(a) the same expected score and (b) the same volatility, so no platform wins more often by structure.
Raw sums of the sheet's 1-4 fit scores fail this: a tool whose scores are higher on average (or more
extreme) wins regardless of the client. So scores are STANDARDISED against a random client:

  per question q and tool t (each informative answer equally likely):
      mean[q][t] = the reference score: the tool's own average over the question's informative answers, or - for
                   requirement questions that have a 'not a priority' answer - the neutral score 2 (that answer is the
                   reference: a stated requirement lifts the tools that meet it, an absent one changes nothing)
      var[q][t]  = variance of the tool's centred score
  for a client's answers (multi-select = average of the selected options' scores = r):
      F[t] = sum over counted questions of  weight * (r - mean[q][t])         (advantage over a random client)
      S[t] = sqrt( sum of weight^2 * var[q][t] )                                (that tool's volatility)
      z[t] = F[t] / S[t]                                                        (the ranking score)
  Under a random client E[z[t]] = 0 and Var[z[t]] is ~equal for every tool.

Other rules (all platform-agnostic):
  * Branching: hidden questions count in neither F nor S. Unknown answers (Other/TBC/Not a priority) are skipped.
  * Excludes (mandatory-constraint filters) remove tools before ranking; they stay in the output as excluded.
  * Pareto guard: if tool B is at least as good as tool A on EVERY counted question (raw score) and better on one,
    A can never outrank B. (Standardisation could otherwise invert this in rare cases.)
  * Ties: broken only by client-answer criteria from the Flow sheet - ecosystem fit (Q04), then governance/security
    fit, then delivery risk and cost - and if still tied the tools SHARE a rank. Sheet/tool order never breaks a tie.
  * The old 'absolute fit' (raw weighted score / maximum) is still returned as `raw_fit` for explanation only.
"""
import copy
import json
import math
import random
import statistics as st
from pathlib import Path

SCORE_MAX = 4
SCORE_MIN = 1
EPS = 1e-9
# Flow sheet tie-break order. The Flow text says "ecosystem fit; governance/security fit; implementation risk and total cost".
TIEBREAK_GROUPS = [
    ("ecosystem", ["Q04"]),
    ("governance", ["Q05", "Q06", "Q07", "Q08", "Q09", "Q26"]),
    ("risk & cost", ["Q10", "Q11", "Q12", "Q20", "Q23"]),
]


def _q(x):
    """Quantise to 1e-9 with floor(x*1e9 + 0.5): identical IEEE operations in Python and JavaScript, unlike round()."""
    return math.floor(x * 1e9 + 0.5)


def _known(q):
    return [o for o in q["options"] if not o["unknown"]]


NEUTRAL_SCORE = 2


def calibration(model):
    """{qid: {"mean": {tool: baseline}, "var": {tool: variance}}} - one uniformly chosen answer per question.
    reference 'mean'   : baseline = the tool's average over the question's informative (non-Unknown) options.
    reference 'neutral': baseline = the neutral score 2 (the 'not a priority' answer); the variance is taken over the
                         centred scores of ALL options, the null answer counting as 0."""
    tools = model["tool_ids"]
    out = {}
    for q in model["questions"]:
        k = _known(q)
        if not k:
            continue
        if q.get("reference", "mean") == "neutral":
            n_null = len(q["options"]) - len(k)
            cs = {t: [o["scores"][t] - NEUTRAL_SCORE for o in k] + [0.0] * n_null for t in tools}
            mean = {t: float(NEUTRAL_SCORE) for t in tools}
            var = {t: st.pvariance(cs[t]) for t in tools}
        else:
            mean = {t: st.mean(o["scores"][t] for o in k) for t in tools}
            var = {t: st.mean((o["scores"][t] - mean[t]) ** 2 for o in k) for t in tools}
        out[q["id"]] = {"mean": mean, "var": var}
    return out


def recalibrate(model):
    """Recompute calibration after the scores were changed (what-if tests). Returns the model."""
    model["calibration"] = calibration(model)
    return model


def load_model(path="data/questions.json"):
    m = json.loads(Path(path).read_text(encoding="utf-8"))
    m["questions"].sort(key=lambda q: q["order"])           # asking order (Order column), not Q ID
    m["qmap"] = {q["id"]: q for q in m["questions"]}
    for q in m["questions"]:
        q["omap"] = {o["id"]: o for o in q["options"]}
    m["tool_ids"] = [t["id"] for t in m["tools"]]
    recalibrate(m)
    # Consume the calibration shipped in the JSON (baseline/variance, written by excel_to_json.py) exactly as the
    # JavaScript engine does, so both engines run on identical numbers. Harness check N7 verifies the JSON matches
    # what the scores imply (calibration() above stays the independent recomputation).
    for q in m["questions"]:
        if "baseline" in q and "variance" in q:
            m["calibration"][q["id"]] = {"mean": dict(q["baseline"]), "var": dict(q["variance"])}
    return m


def tiebreak_groups(model):
    """Tie-break groups: from the JSON (meta.tieBreak, the single source for both engines) or the defaults above."""
    tb = (model.get("meta") or {}).get("tieBreak")
    return [(g["name"], g["questions"]) for g in tb] if tb else TIEBREAK_GROUPS


def is_visible(q, answers):
    for cl in q["showIf"]:
        sel = answers.get(cl["q"]) or []
        if not set(sel) & set(cl["in"]):
            return False
    return True


def visible_questions(model, answers):
    """Visible set, evaluated in asking order so parents resolve before children.
    A hidden parent's answers are ignored (stale-answer protection)."""
    live, vis = {}, []
    for q in sorted(model["questions"], key=lambda x: x["order"]):
        if is_visible(q, live):
            vis.append(q)
            if q["id"] in answers:
                live[q["id"]] = answers[q["id"]]
    return vis, live


def dominates(b, a, per_q):
    """True if tool b is >= tool a on every counted question and > on at least one (raw scores)."""
    ge = all(r[b] >= r[a] - EPS for r in per_q.values())
    gt = any(r[b] > r[a] + EPS for r in per_q.values())
    return ge and gt


def score(model, answers, weights=None, mode="neutral"):
    """answers: {qid: [option_id, ...]}. weights: optional {qid: weight}. mode: 'neutral' (default) or 'raw'.
    Returns z (ranking score), raw_fit, rank (competition ranks, ties share), ranked (ordered tool ids,
    excluded tools omitted), excluded, counted, margin (z of #1 minus z of #2), norm (alias of raw_fit)."""
    weights = weights or {}
    tools = model["tool_ids"]
    cal = model["calibration"]
    vis, live = visible_questions(model, answers)
    F = {t: 0.0 for t in tools}
    S2 = {t: 0.0 for t in tools}
    raw_tot = {t: 0.0 for t in tools}
    groups = tiebreak_groups(model)
    sub = {g: {t: 0.0 for t in tools} for g, _ in groups}
    per_q, counted, excluded = {}, [], set()
    denom = 0.0
    for q in vis:
        sel = [q["omap"][o] for o in live.get(q["id"], []) if o in q["omap"]]
        for o in sel:
            excluded.update(o["excludes"])
        kn = [o for o in sel if not o["unknown"]]
        w = weights.get(q["id"], q["weight"])
        if not kn or w == 0 or q["id"] not in cal:
            continue
        r = {t: sum(o["scores"][t] for o in kn) / len(kn) for t in tools}
        per_q[q["id"]] = r
        counted.append(q["id"])
        denom += w * SCORE_MAX
        for t in tools:
            c = w * (r[t] - cal[q["id"]]["mean"][t])
            F[t] += c
            S2[t] += w * w * cal[q["id"]]["var"][t]
            raw_tot[t] += w * r[t]
            for g, ids in groups:
                if q["id"] in ids:
                    sub[g][t] += c
    z = {t: (F[t] / math.sqrt(S2[t]) if S2[t] > EPS else 0.0) for t in tools}
    raw_fit = {t: (raw_tot[t] / denom if denom else 0.0) for t in tools}
    primary = z if mode == "neutral" else raw_fit
    eligible = [t for t in tools if t not in excluded]

    def key(t):   # smaller is better; quantised so float noise never decides a rank (same integer rule as engine.js)
        return (_q(-primary[t]),) + tuple(_q(-sub[g][t]) for g, _ in groups)
    by_key = sorted(eligible, key=lambda t: (key(t), t))     # name only gives a stable LIST order; ranks below ignore it
    # Pareto guard: repeatedly take the best-scoring tool that no REMAINING tool dominates. Dominance is a strict
    # partial order (transitive, acyclic), so this always finishes and only reorders where it must.
    order, remaining = [], list(by_key)
    while remaining:
        pick = next(t for t in remaining if not any(dominates(u, t, per_q) for u in remaining if u != t))
        order.append(pick)
        remaining.remove(pick)
    rank = {}
    for i, t in enumerate(order):
        if i and key(t) == key(order[i - 1]) and not dominates(order[i - 1], t, per_q) and not dominates(t, order[i - 1], per_q):
            rank[t] = rank[order[i - 1]]
        else:
            rank[t] = i + 1
    # lead of #1 over #2 in z; never negative (the Pareto guard can place a lower-z tool first, then the lead is 0)
    margin = max(0.0, primary[order[0]] - primary[order[1]]) if len(order) > 1 else 0.0
    return {"z": z, "raw_fit": raw_fit, "norm": raw_fit, "rank": rank, "ranked": order, "excluded": sorted(excluded),
            "counted": counted, "denominator": denom, "visible": [q["id"] for q in vis], "margin": margin,
            "tied_leaders": [t for t in order if rank[t] == 1]}


def random_answers(model, rng, multi_max=3, fixed=None):
    """Uniform random respondent. Single: one option. Multi: 1..multi_max distinct options.
    `fixed` pins some answers. Branching is respected (hidden questions get no answer)."""
    fixed = fixed or {}
    ans = {}
    for q in sorted(model["questions"], key=lambda x: x["order"]):
        if not is_visible(q, ans):
            continue
        if q["id"] in fixed:
            ans[q["id"]] = list(fixed[q["id"]])
            continue
        ids = [o["id"] for o in q["options"]]
        if q["type"] == "single":
            ans[q["id"]] = [rng.choice(ids)]
        else:
            k = rng.randint(1, min(multi_max, len(ids)))
            ans[q["id"]] = rng.sample(ids, k)
    return ans


def with_model_changes(model, weight_changes=None, showif_changes=None, score_changes=None):
    """Return a variant of the model for what-if testing (does not mutate the original).
    score_changes: {(qid, option_id): {tool: score}}. Calibration is recomputed."""
    m = copy.deepcopy(model)
    for qid, w in (weight_changes or {}).items():
        m["qmap"][qid]["weight"] = w
    for qid, sh in (showif_changes or {}).items():
        m["qmap"][qid]["showIf"] = sh
    for (qid, oid), sc in (score_changes or {}).items():
        m["qmap"][qid]["omap"][oid]["scores"].update(sc)
    return recalibrate(m)
