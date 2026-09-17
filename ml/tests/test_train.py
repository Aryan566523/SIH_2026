# -*- coding: utf-8 -*-
"""End-to-end training pipeline tests (conditions 5.5/5.7, artifact integrity)."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent


def _run_train(tmp_path, extra=None):
    cmd = [sys.executable, str(ML_DIR / "train.py"), "--n-wallets", "250", "--seed", "7",
           "--out", str(tmp_path)]
    if extra:
        cmd += extra
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=ML_DIR, timeout=600)
    return res


def test_training_run_produces_artifacts(tmp_path):
    res = _run_train(tmp_path)
    assert res.returncode == 0, res.stdout + res.stderr
    for name in ("model.json", "manifest.json", "metrics.json", "golden_vectors.json", "MODEL_CARD.md"):
        assert (tmp_path / name).exists(), f"missing {name}"


def test_manifest_sha_matches_model(tmp_path):
    _run_train(tmp_path)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256((tmp_path / "model.json").read_bytes()).hexdigest()
    assert manifest["model_sha256"] == digest
    assert manifest["model_version"] == "xgb-wallet-v1"
    assert manifest["confidence_threshold"] == 0.6
    assert manifest["min_feature_support_txs"] == 3


def test_metric_gates_pass_and_are_recorded(tmp_path):
    _run_train(tmp_path)
    metrics = json.loads((tmp_path / "metrics.json").read_text(encoding="utf-8"))
    assert metrics["gate_passed"] is True
    test = metrics["test"]
    for key, bound in metrics["gates"].items():
        if key in ("false_positive_rate", "ece"):
            assert test[key] <= bound
        else:
            assert test[key] >= bound


def test_golden_vectors_consistent(tmp_path):
    _run_train(tmp_path)
    gold = json.loads((tmp_path / "golden_vectors.json").read_text(encoding="utf-8"))
    assert len(gold["vectors"]) == 3
    for v in gold["vectors"]:
        assert len(v["features"]) == 25
        assert abs(v["efficiency_residual"]) < 1e-4
        assert 0.0 < v["probability"] < 1.0
        assert len(v["shap"]) > 0


def test_model_json_has_cover_stats(tmp_path):
    _run_train(tmp_path)
    model = json.loads((tmp_path / "model.json").read_text(encoding="utf-8"))
    tree = model["learner"]["gradient_booster"]["model"]["trees"][0]["tree_structure"]
    assert "cover" in tree
    assert "split" in tree


def test_synthetic_data_provenance_recorded(tmp_path):
    _run_train(tmp_path)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    prov = manifest["data_provenance"]
    assert prov["synthetic"]["is_synthetic"] is True
    assert prov["synthetic"]["n_wallets"] == 250
    assert manifest["split"]["method"].startswith("by case_id")