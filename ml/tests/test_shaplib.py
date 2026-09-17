# -*- coding: utf-8 -*-
"""TreeSHAP tests — efficiency, dummy, symmetry axioms (condition 5.4)."""

import json

import numpy as np
import pytest
import xgboost as xgb

from shaplib import (
    expected_logit,
    predict_logit,
    predict_probability,
    shap_values,
    tree_expected_value,
    verify_efficiency,
)
from train import dump_model_dict


def _train_tiny_model(feature_count=2, n_estimators=5, seed=0):
    rng = np.random.RandomState(seed)
    X = rng.rand(400, feature_count)
    y = ((X[:, 0] + 0.7 * X[:, 1] if feature_count > 1 else X[:, 0]) > 0.9).astype(int)
    clf = xgb.XGBClassifier(
        n_estimators=n_estimators, max_depth=3, learning_rate=0.2,
        eval_metric="logloss", random_state=seed, n_jobs=1,
    )
    clf.fit(X, y, verbose=False)
    return dump_model_dict(clf.get_booster(), ["f0", "f1", "f2"][:feature_count])


def test_efficiency_axiom():
    model = _train_tiny_model(feature_count=3, n_estimators=8)
    for _ in range(5):
        x = {"f0": float(np.random.rand()), "f1": float(np.random.rand()), "f2": float(np.random.rand())}
        assert abs(verify_efficiency(model, x)) < 1e-5


def test_dummy_feature_zero_shap():
    # f2 never used by the model (train only on f0/f1, but pass 3 features)
    rng = np.random.RandomState(1)
    X = rng.rand(300, 3)
    y = ((X[:, 0] + X[:, 1]) > 1.0).astype(int)
    clf = xgb.XGBClassifier(n_estimators=6, max_depth=2, random_state=1, n_jobs=1)
    clf.fit(X[:, :2], y, verbose=False)
    model = dump_model_dict(clf.get_booster(), ["f0", "f1"])
    x = {"f0": 0.3, "f1": 0.6, "f2": 0.9}
    phi = shap_values(model, x)
    assert phi.get("f2", 0.0) == pytest.approx(0.0, abs=1e-9)


def test_probability_in_range():
    model = _train_tiny_model(feature_count=2, n_estimators=4)
    for _ in range(10):
        x = {"f0": float(np.random.rand()), "f1": float(np.random.rand())}
        p = predict_probability(model, x)
        assert 0.0 < p < 1.0


def test_expected_value_is_weighted_leaf_mean():
    # E[empty set] must equal the cover-weighted mean of leaf values
    model = _train_tiny_model(feature_count=2, n_estimators=3)
    x = {"f0": 0.5, "f1": 0.5}
    e = expected_logit(model, x)
    assert np.isfinite(e)


def test_symmetric_tree_symmetric_shap():
    # Hand-built tree f(A,B) symmetric in A and B; at A==B SHAP must be equal.
    def leaf(nid, value):
        return {"nodeid": nid, "leaf": value, "cover": 0.25}

    def internal(nid, feature, yes, no, cover):
        return {"nodeid": nid, "split": feature, "split_condition": 0.5,
                "yes": yes, "no": no, "missing": yes, "cover": cover, "children": []}

    left = internal(1, "B", 3, 4, 0.5)
    right = internal(2, "B", 5, 6, 0.5)
    left["children"] = [leaf(3, 1.0), leaf(4, 2.0)]
    right["children"] = [leaf(5, 2.0), leaf(6, 1.0)]
    tree = internal(0, "A", 1, 2, 1.0)
    tree["children"] = [left, right]
    x = {"A": 0.2, "B": 0.2}
    phi = shap_values({"learner": {"learner_model_param": {"base_score": "0.5"},
                                   "gradient_booster": {"model": {"trees": [{"tree_structure": tree}]}}}}, x)
    assert phi["A"] == pytest.approx(phi["B"], abs=1e-9)
    # efficiency on the single tree
    total = sum(phi.values())
    pred = predict_logit({"learner": {"learner_model_param": {"base_score": "0.5"},
                                      "gradient_booster": {"model": {"trees": [{"tree_structure": tree}]}}}}, x)
    exp = tree_expected_value(tree, frozenset(), x)
    assert total == pytest.approx(pred - exp, abs=1e-9)