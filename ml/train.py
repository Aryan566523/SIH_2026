# -*- coding: utf-8 -*-
"""Train the wallet risk model (XGBoost) and export deployable artifacts.

Pipeline (matches for-implementation/prompt.md §10 and scope.md §2.7):
  1. Build the labeled dataset: deterministic synthetic fraud/legit wallet
     samples (tagged is_synthetic=True). Optionally also train a separate
     tx-level benchmark model on the real-world Elliptic dataset
     (--with-elliptic) — never mixed with synthetic data.
  2. Leakage-safe split by wallet/case/time (split.py).
  3. Train XGBoost (binary:logistic), early-stopping on validation AUC.
  4. Evaluate: precision, recall, F1, ROC-AUC, false-positive rate,
     calibration (ECE). Gate deployment on thresholds (condition 5.7).
  5. Export model.json (with cover stats), manifest.json, metrics.json,
     golden_vectors.json and MODEL_CARD.md to --out.

Usage:
  python train.py                          # synthetic only (fast, offline)
  python train.py --with-elliptic          # + Elliptic tx-level benchmark model
  python train.py --force                  # ignore metric gates (exit 0)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xgboost as xgb

from features import FEATURE_DEFS, FEATURE_NAMES, extract_wallet_features
from shaplib import predict_logit, predict_probability, shap_values, verify_efficiency
from split import leakage_safe_split
from synthetic import generate_dataset, samples_to_rows

MODEL_VERSION = "xgb-wallet-v1"

# Deployment gates (for-implementation/conditions.md 5.7, scope.md §2.7)
METRIC_GATES = {
    "roc_auc": 0.85,
    "f1": 0.70,
    "precision": 0.70,
    "recall": 0.70,
    "false_positive_rate": 0.15,  # upper bound
    "ece": 0.10,                  # upper bound (calibration error)
}

CONFIDENCE_THRESHOLD = 0.6   # condition 5.1: below -> UNKNOWN
MIN_FEATURE_SUPPORT_TXS = 3  # condition 5.2


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------


def sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def evaluate(labels: np.ndarray, probs: np.ndarray) -> dict:
    from sklearn.metrics import (
        auc, f1_score, precision_score, recall_score, roc_curve,
    )

    preds = (probs >= 0.5).astype(int)
    fpr, tpr, _ = roc_curve(labels, probs)
    # ECE (expected calibration error), 10 bins
    bins = np.linspace(0, 1, 11)
    idx = np.clip(np.digitize(probs, bins) - 1, 0, 9)
    ece = 0.0
    for b in range(10):
        mask = idx == b
        if mask.sum() == 0:
            continue
        ece += (mask.sum() / len(probs)) * abs(probs[mask].mean() - labels[mask].mean())
    return {
        "precision": round(float(precision_score(labels, preds, zero_division=0)), 4),
        "recall": round(float(recall_score(labels, preds, zero_division=0)), 4),
        "f1": round(float(f1_score(labels, preds, zero_division=0)), 4),
        "roc_auc": round(float(auc(fpr, tpr)), 4),
        "false_positive_rate": round(float(fpr[1]) if len(fpr) > 1 else 0.0, 4),
        "ece": round(float(ece), 4),
        "n": int(len(labels)),
        "positive_rate": round(float(labels.mean()), 4),
    }


def gate_passed(metrics: dict, gates: dict) -> tuple:
    failures = []
    for key, bound in gates.items():
        val = metrics[key]
        if key in ("false_positive_rate", "ece"):
            if val > bound:
                failures.append(f"{key}={val} > {bound}")
        else:
            if val < bound:
                failures.append(f"{key}={val} < {bound}")
    return (len(failures) == 0), failures


# ---------------------------------------------------------------------------
# Artifact export
# ---------------------------------------------------------------------------


def dump_model_dict(booster: xgb.Booster, feature_names: list) -> dict:
    """Version-safe export of an XGBoost booster to the portable dict format
    consumed by shaplib.py (and mirrored by the Node.js runtime).

    xgboost >= 3.4 changed its Python APIs (get_dump returns a list of
    per-tree JSON strings; save_raw stores trees in a compact numeric form), so
    we assemble the human-readable tree_structure + cover stats ourselves.
    """
    trees = [json.loads(s) for s in booster.get_dump(dump_format="json", with_stats=True)]
    raw = json.loads(booster.save_raw(raw_format="json"))
    base = raw["learner"]["learner_model_param"]["base_score"]
    # xgboost >= 3.4 can return base_score as a list or a stringified list
    # like "[3.3874458E-1]" depending on the version — normalize to a float.
    if isinstance(base, (list, tuple)):
        base = base[0] if base else 0.5
    elif isinstance(base, str):
        s = base.strip()
        if s.startswith("[") and s.endswith("]"):
            s = s[1:-1].strip()
        try:
            base = float(s)
        except ValueError:
            base = 0.5

    def rename(node: dict) -> dict:
        node = dict(node)
        if "split" in node and node["split"].startswith("f") and node["split"][1:].isdigit():
            idx = int(node["split"][1:])
            if idx < len(feature_names):
                node["split"] = feature_names[idx]
        if "children" in node:
            node["children"] = [rename(c) for c in node["children"]]
        return node

    return {
        "learner": {
            "learner_model_param": {"base_score": str(base)},
            "gradient_booster": {"model": {"trees": [{"tree_structure": rename(t)} for t in trees]}},
            "objective": raw["learner"].get("objective", {"name": "binary:logistic"}),
        }
    }


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def export_artifacts(out_dir: Path, booster: xgb.Booster, metrics: dict,
                     train_metrics: dict, val_metrics: dict, test_metrics: dict,
                     feature_minmax: dict, expected_prob_mean: float,
                     provenance: dict, split_info: dict, golden: list,
                     gates: dict, force: bool) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    model_dict = dump_model_dict(booster, FEATURE_NAMES)
    model_json = json.dumps(model_dict)
    model_path = out_dir / "model.json"
    model_path.write_text(model_json, encoding="utf-8")
    model_sha = sha256_file(model_path)

    manifest = {
        "model_version": MODEL_VERSION,
        "model_type": "xgboost_binary_logistic",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_sha256": model_sha,
        "objective": "binary:logistic",
        "n_trees": len(model_dict["learner"]["gradient_booster"]["model"]["trees"]),
        "features": FEATURE_DEFS,
        "feature_minmax": feature_minmax,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "min_feature_support_txs": MIN_FEATURE_SUPPORT_TXS,
        "metric_gates": gates,
        "metrics": {"train": train_metrics, "validation": val_metrics, "test": test_metrics},
        "expected_prob_mean": round(float(expected_prob_mean), 6),
        "split": split_info,
        "data_provenance": provenance,
        "label_definition": "1 = wallet participates in a known fraud-flow pattern (synthetic, clearly labeled); 0 = legitimate behavior",
        "usage_limits": [
            "AI output is prioritization, not a verdict (RULES §0.3).",
            "Every prediction ships with SHAP explanation + model version + model hash (condition 5.4).",
            "Confidence < threshold => UNKNOWN classification (condition 5.1).",
            "Insufficient transaction history => INSUFFICIENT_DATA (condition 5.2).",
            "Infrastructure nodes (miner/validator) are never scored (condition 5.3).",
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    metrics_out = {
        "model_version": MODEL_VERSION,
        "model_sha256": model_sha,
        "gates": gates,
        "gate_passed": gate_passed(test_metrics, gates)[0],
        "test": test_metrics,
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics_out, indent=2), encoding="utf-8")

    (out_dir / "golden_vectors.json").write_text(
        json.dumps({"model_sha256": model_sha, "vectors": golden}, indent=2), encoding="utf-8")

    return model_sha


# ---------------------------------------------------------------------------
# Elliptic benchmark model (separate, real-world, tx-level)
# ---------------------------------------------------------------------------


def train_elliptic_model(elliptic_dir: Path, out_dir: Path, seed: int) -> dict:
    """Train a separate tx-level model on the Elliptic dataset.

    Uses the 25 highest-variance feature columns, splits chronologically by
    time step (Elliptic's own temporal ordering), and reports metrics.
    Results are stored under artifacts/elliptic/ and summarized in the model
    card — clearly separated from the synthetic wallet model.
    """
    import pandas as pd

    features_path = elliptic_dir / "elliptic_txs_features.csv"
    classes_path = elliptic_dir / "elliptic_txs_classes.csv"
    if not (features_path.exists() and classes_path.exists()):
        raise FileNotFoundError(
            "Elliptic files missing. Run: python download_data.py --full")

    print("[elliptic] loading features (large file, one-time)...")
    feats = pd.read_csv(features_path, header=None)
    classes = pd.read_csv(classes_path, header=None, names=["tx_id", "time_step", "class"])

    # first column is tx_id
    tx_ids = feats.iloc[:, 0]
    X = feats.iloc[:, 1:]
    # label: licit=0, illicit/illicit_2=1; unknown excluded
    label_map = {"licit": 0, "illicit": 1, "illicit_2": 1}
    merged = pd.concat([classes.set_index("tx_id"), X.set_index(tx_ids)], axis=1, join="inner")
    merged = merged[merged["class"].isin(label_map)]
    merged["label"] = merged["class"].map(label_map)

    # keep the 25 highest-variance numeric columns (interpretable subset)
    numeric = merged.select_dtypes(include=[np.number]).drop(columns=["label", "time_step"])
    variances = numeric.var().sort_values(ascending=False)
    cols = list(variances.head(25).index)
    Xm = merged[cols].fillna(0.0)
    y = merged["label"].values
    steps = merged["time_step"].values

    # chronological split by time step (no leakage)
    n = len(Xm)
    idx = np.argsort(steps, kind="stable")
    Xs, ys, ss = Xm.iloc[idx], y[idx], steps[idx]
    n_train = int(n * 0.7)
    n_val = int(n * 0.85)
    Xtr, Xva, Xte = Xs.iloc[:n_train], Xs.iloc[n_train:n_val], Xs.iloc[n_val:]
    ytr, yva, yte = ys[:n_train], ys[n_train:n_val], ys[n_val:]
    if ss[n_train - 1] > ss[n_train]:
        raise RuntimeError("elliptic time split violated")

    clf = xgb.XGBClassifier(
        n_estimators=150, max_depth=5, learning_rate=0.08, subsample=0.8,
        colsample_bytree=0.8, min_child_weight=2, eval_metric="logloss",
        early_stopping_rounds=15, random_state=seed, n_jobs=-1,
    )
    clf.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    probs = clf.predict_proba(Xte)[:, 1]
    metrics = evaluate(yte, probs)

    e_out = out_dir / "elliptic"
    e_out.mkdir(parents=True, exist_ok=True)
    booster = clf.get_booster()
    (e_out / "model.json").write_text(json.dumps(dump_model_dict(booster, cols)), encoding="utf-8")
    (e_out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (e_out / "features.json").write_text(json.dumps(cols, indent=2), encoding="utf-8")
    return {"metrics": metrics, "features": cols, "n": int(n)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser(description="Train the ChainSentinel wallet risk model")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--n-wallets", type=int, default=4000)
    ap.add_argument("--out", default=str(Path(__file__).parent / "artifacts"))
    ap.add_argument("--with-elliptic", action="store_true")
    ap.add_argument("--elliptic-dir", default=str(Path(__file__).parent / "data" / "elliptic"))
    ap.add_argument("--force", action="store_true", help="ignore metric gates")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- 1. dataset ---
    print(f"[train] generating {args.n_wallets} synthetic wallet samples (seed={args.seed})...")
    samples = generate_dataset(n_wallets=args.n_wallets, seed=args.seed)
    rows = samples_to_rows(samples)
    n_fraud = sum(1 for r in rows if r["label"] == 1)
    print(f"[train] samples={len(rows)} fraud={n_fraud} legit={len(rows) - n_fraud} "
          f"all_synthetic={all(r['is_synthetic'] for r in rows)}")

    # --- 2. leakage-safe split ---
    train, val, test = leakage_safe_split(rows)
    print(f"[train] split train={len(train)} val={len(val)} test={len(test)} (by wallet/case/time)")

    # --- 3. train (DataFrames so the dump carries real feature names) ---
    import pandas as pd

    def _frame(part):
        return pd.DataFrame([{n: r[n] for n in FEATURE_NAMES} for r in part], columns=FEATURE_NAMES)

    Xtr = _frame(train)
    Xva = _frame(val)
    Xte = _frame(test)
    ytr = pd.Series([r["label"] for r in train])
    yva = pd.Series([r["label"] for r in val])
    yte = pd.Series([r["label"] for r in test])

    # logloss early stopping: rank-only metrics (auc) stop too early and leave
    # probabilities miscalibrated; logloss stops when calibration converges.
    clf = xgb.XGBClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.08, subsample=0.8,
        colsample_bytree=0.8, min_child_weight=2, eval_metric="logloss",
        early_stopping_rounds=20, random_state=args.seed, n_jobs=-1,
    )
    print("[train] fitting XGBoost (early stopping on validation AUC)...")
    clf.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=args.verbose)
    booster = clf.get_booster()

    # --- 4. evaluate ---
    probs_tr = clf.predict_proba(Xtr)[:, 1]
    probs_va = clf.predict_proba(Xva)[:, 1]
    probs_te = clf.predict_proba(Xte)[:, 1]
    m_tr = evaluate(ytr, probs_tr)
    m_va = evaluate(yva, probs_va)
    m_te = evaluate(yte, probs_te)
    print("[train] TEST metrics:", json.dumps(m_te))
    ok, failures = gate_passed(m_te, METRIC_GATES)
    print(f"[train] metric gates: {'PASSED' if ok else 'BLOCKED'}"
          + (f" - {failures}" if failures else ""))
    if not ok and not args.force:
        print("[train] deployment blocked by metric gates (condition 5.7). "
              "Use --force to export anyway.")
        return 1

    # --- 5. feature min/max + expected prob mean (drift baseline) ---
    all_X = np.vstack([Xtr, Xva, Xte])
    feature_minmax = {
        n: [float(all_X[:, i].min()), float(all_X[:, i].max())]
        for i, n in enumerate(FEATURE_NAMES)
    }
    expected_prob_mean = float(probs_tr.mean())

    # --- 6. golden vectors (cross-language consistency tests) ---
    model_dict = dump_model_dict(booster, FEATURE_NAMES)
    samples_by_id = {s["wallet_id"]: s for s in samples}
    golden = []
    for idx in [0, len(test) // 2, len(test) - 1]:
        r = test[idx]
        feats = {n: r[n] for n in FEATURE_NAMES}
        logit = predict_logit(model_dict, feats)
        prob = 1.0 / (1.0 + np.exp(-logit))
        phi = shap_values(model_dict, feats)
        eff = verify_efficiency(model_dict, feats)
        golden.append({
            "wallet_id": r["wallet_id"],
            "features": feats,
            "label": r["label"],
            "logit": round(float(logit), 6),
            "probability": round(float(prob), 6),
            "shap": {k: round(float(v), 6) for k, v in phi.items()},
            "efficiency_residual": round(float(eff), 9),
            # raw transactions + context so the Node.js runtime can validate
            # its own feature extraction against the Python-trained features
            "txs": samples_by_id[r["wallet_id"]]["txs"],
            "first_seen": samples_by_id[r["wallet_id"]]["first_seen"],
            "distance_from_report": samples_by_id[r["wallet_id"]]["distance_from_report"],
        })

    provenance = {
        "synthetic": {
            "n_wallets": len(rows),
            "n_fraud": n_fraud,
            "n_legit": len(rows) - n_fraud,
            "labeled": True,
            "is_synthetic": True,
            "patterns": sorted({r["pattern"] for r in rows}),
        },
        "elliptic": None,
    }
    split_info = {
        "method": "by case_id, ordered chronologically by first_seen (wallet/case/time)",
        "train": len(train), "validation": len(val), "test": len(test),
    }

    # --- 7. optional Elliptic benchmark model ---
    elliptic_metrics = None
    if args.with_elliptic:
        try:
            res = train_elliptic_model(Path(args.elliptic_dir), out_dir, args.seed)
            elliptic_metrics = res["metrics"]
            provenance["elliptic"] = {
                "n_transactions": res["n"],
                "n_features": len(res["features"]),
                "metrics": res["metrics"],
                "note": "separate tx-level benchmark model; never mixed with synthetic data",
            }
            print("[train] Elliptic benchmark model:", json.dumps(elliptic_metrics))
        except FileNotFoundError as e:
            print(f"[train] skipping Elliptic: {e}")

    model_sha = export_artifacts(
        out_dir, booster, m_te, m_tr, m_va, m_te, feature_minmax,
        expected_prob_mean, provenance, split_info, golden, METRIC_GATES, args.force)

    _write_model_card(out_dir, m_tr, m_va, m_te, split_info, provenance,
                      elliptic_metrics, model_sha, ok, args.force)

    print(f"\n[OK] Training complete. Artifacts in {out_dir}")
    print(f"   model.json sha256: {model_sha}")
    print(f"   gates: {'PASSED' if ok else 'BLOCKED (--force used)'}")
    return 0


def _write_model_card(out_dir: Path, m_tr: dict, m_va: dict, m_te: dict,
                      split_info: dict, provenance: dict, elliptic_metrics: dict,
                      model_sha: str, gates_ok: bool, force: bool) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# Model Card — {MODEL_VERSION}",
        "",
        f"Generated: {now}  ·  model.json sha256: `{model_sha}`",
        "",
        "## Purpose",
        "Wallet-level fraud-flow risk prioritization. AI output is **prioritization,**",
        "never a verdict (RULES.md §0.3). Every prediction ships with a SHAP",
        "explanation, model version and model hash (condition 5.4).",
        "",
        "## Model",
        "- Algorithm: XGBoost (binary:logistic), 25 interpretable features",
        "- Feature groups: transaction / behavior / graph / flow-time",
        "- Objective: P(wallet participates in a fraud-flow pattern)",
        "",
        "## Training data",
        f"- Synthetic labeled wallets: {provenance['synthetic']['n_wallets']} "
        f"({provenance['synthetic']['n_fraud']} fraud, {provenance['synthetic']['n_legit']} legit)",
        "- **All synthetic data is labeled `is_synthetic: true`** and is never",
        "  presented as real-world validation.",
        f"- Patterns: {', '.join(sorted(provenance['synthetic']['patterns']))}",
        "",
        "## Split (leakage-safe)",
        f"- Method: {split_info['method']}",
        f"- train={split_info['train']} val={split_info['validation']} test={split_info['test']}",
        "- Verified: no wallet/case appears in two partitions; time ordering enforced.",
        "",
        "## Evaluation (held-out test)",
        "| Metric | Value | Gate |",
        "|---|---|---|",
    ]
    for k, v in m_te.items():
        gate = METRIC_GATES.get(k, "—")
        lines.append(f"| {k} | {v} | {'≤' if k in ('false_positive_rate', 'ece') else '≥'} {gate} |")
    lines += [
        "",
        f"Gate result: **{'PASSED' if gates_ok else 'BLOCKED — exported with --force'}** (condition 5.7)",
        "",
    ]
    if elliptic_metrics:
        lines += [
            "## Real-world benchmark (separate model, never mixed)",
            f"- Elliptic tx-level model trained on {provenance['elliptic']['n_transactions']} labeled "
            f"Bitcoin transactions, {provenance['elliptic']['n_features']} features, chronological split.",
            "- Metrics: " + ", ".join(f"{k}={v}" for k, v in elliptic_metrics.items()),
            "",
        ]
    lines += [
        "## Deployment conditions",
        "- Confidence < 0.6 → `UNKNOWN` (condition 5.1)",
        "- < 3 transactions → `INSUFFICIENT_DATA` (condition 5.2)",
        "- Infra nodes (miner/validator) are never scored (condition 5.3)",
        "- New model versions must re-pass gates on a held-out set (condition 5.5)",
        "- Prediction-distribution drift vs expected mean is monitored (drift check)",
        "",
        "## Known limitations",
        "- Trained on synthetic data; real-world validation is the separate Elliptic",
        "  benchmark model. Treat wallet-model scores as demo-grade prioritization.",
        "- Features are wallet-level; graph features use 1-hop entity context.",
    ]
    (out_dir / "MODEL_CARD.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())