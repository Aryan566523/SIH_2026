# -*- coding: utf-8 -*-
"""Exact TreeSHAP for XGBoost JSON model dumps.

Implements the exact Shapley-value attribution for additive tree ensembles
(Lundberg et al., "Consistent Individualized Feature Attribution for Tree
Ensembles", 2018) using the training cover statistics exported by
`bst.get_dump(with_stats=True)`.

Key facts:
  * For a single tree, only the features on the root->leaf path of the query
    point can influence the prediction, so SHAP values are computed over the
    path features only (off-path features get exactly 0).
  * Marginal expectations E[S] (features in S fixed to the query values, the
    rest marginalized over the training distribution) are computed from the
    per-node `cover` fractions.
  * For a sum of trees, SHAP values add: phi_total = sum over trees.
  * SHAP is computed in the model's output space (logit). Efficiency holds:
    sum(phi) == logit(x) - expected_logit.

The Node.js runtime mirrors this algorithm exactly in
apps/api/src/modules/risk/ml-model.ts and is validated against golden vectors
produced by train.py.
"""

from __future__ import annotations

import json
import math
from itertools import combinations
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Tree walking
# ---------------------------------------------------------------------------


def _children_index(node: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    return {c["nodeid"]: c for c in node.get("children", [])}


def tree_value(node: Dict[str, Any], x: Dict[str, float]) -> float:
    """Evaluate a single tree for feature vector x (all features present)."""
    while "leaf" not in node:
        feat = node["split"]
        xv = x.get(feat, 0.0)
        if xv < node["split_condition"]:
            node = _children_index(node)[node["yes"]]
        else:
            node = _children_index(node)[node["no"]]
    return float(node["leaf"])


def tree_expected_value(node: Dict[str, Any], fixed: frozenset, x: Dict[str, float]) -> float:
    """E[S]: expected tree output with features in `fixed` set to x's values,
    all other features marginalized over the training distribution."""
    if "leaf" in node:
        return float(node["leaf"])
    feat = node["split"]
    kids = _children_index(node)
    if feat in fixed:
        xv = x.get(feat, 0.0)
        child = kids[node["yes"]] if xv < node["split_condition"] else kids[node["no"]]
        return tree_expected_value(child, fixed, x)
    # marginalize: weighted average of children by training cover
    parent_cover = float(node.get("cover", 1.0)) or 1.0
    left = kids[node["yes"]]
    right = kids[node["no"]]
    wl = (float(left.get("cover", parent_cover))) / parent_cover
    wr = (float(right.get("cover", parent_cover))) / parent_cover
    return wl * tree_expected_value(left, fixed, x) + wr * tree_expected_value(right, fixed, x)


def tree_shap_values(node: Dict[str, Any], x: Dict[str, float]) -> Dict[str, float]:
    """Exact SHAP values for one tree at point x (path-feature enumeration)."""
    # collect the root->leaf path features
    path: List[str] = []
    n = node
    while "leaf" not in n:
        feat = n["split"]
        path.append(feat)
        kids = _children_index(n)
        xv = x.get(feat, 0.0)
        n = kids[n["yes"]] if xv < n["split_condition"] else kids[n["no"]]
    uniq: List[str] = []
    for f in path:
        if f not in uniq:
            uniq.append(f)
    p = len(uniq)
    phi: Dict[str, float] = {f: 0.0 for f in uniq}

    for i, f in enumerate(uniq):
        others = [g for g in uniq if g != f]
        for k in range(len(others) + 1):
            weight = math.factorial(k) * math.factorial(p - k - 1) / math.factorial(p)
            for S_tuple in combinations(others, k):
                S = frozenset(S_tuple)
                e1 = tree_expected_value(node, S | frozenset([f]), x)
                e0 = tree_expected_value(node, S, x)
                phi[f] += weight * (e1 - e0)
    return phi


# ---------------------------------------------------------------------------
# Model-level helpers (XGBoost JSON dump)
# ---------------------------------------------------------------------------


def _base_logit(model: Dict[str, Any]) -> float:
    base = model.get("learner", {}).get("learner_model_param", {}).get("base_score")
    try:
        base = float(base)
    except (TypeError, ValueError):
        base = 0.5
    if 0.0 < base < 1.0:
        return math.log(base / (1.0 - base))
    return base


def get_trees(model: Dict[str, Any]) -> List[Dict[str, Any]]:
    return model["learner"]["gradient_booster"]["model"]["trees"]


def predict_logit(model: Dict[str, Any], x: Dict[str, float]) -> float:
    logit = _base_logit(model)
    for tree in get_trees(model):
        logit += tree_value(tree["tree_structure"], x)
    return logit


def predict_probability(model: Dict[str, Any], x: Dict[str, float]) -> float:
    logit = predict_logit(model, x)
    return 1.0 / (1.0 + math.exp(-logit))


def expected_logit(model: Dict[str, Any], x: Optional[Dict[str, float]] = None) -> float:
    """Expected model margin over the training distribution (x is unused for
    E[empty set]; kept for signature symmetry)."""
    logit = _base_logit(model)
    for tree in get_trees(model):
        logit += tree_expected_value(tree["tree_structure"], frozenset(), {})
    return logit


def shap_values(model: Dict[str, Any], x: Dict[str, float]) -> Dict[str, float]:
    phi: Dict[str, float] = {}
    for tree in get_trees(model):
        for f, v in tree_shap_values(tree["tree_structure"], x).items():
            phi[f] = phi.get(f, 0.0) + v
    return phi


def shap_explanation(model: Dict[str, Any], x: Dict[str, float], top_k: int = 5) -> List[Dict[str, Any]]:
    """Top contributing features with their SHAP contributions (logit space)."""
    phi = shap_values(model, x)
    ranked = sorted(phi.items(), key=lambda kv: -abs(kv[1]))
    return [{"feature": f, "contribution": round(v, 6)} for f, v in ranked[:top_k]]


def verify_efficiency(model: Dict[str, Any], x: Dict[str, float], tol: float = 1e-6) -> float:
    """Returns the efficiency residual: sum(phi) - (logit - expected_logit)."""
    phi = shap_values(model, x)
    total = sum(phi.values())
    return total - (predict_logit(model, x) - expected_logit(model))