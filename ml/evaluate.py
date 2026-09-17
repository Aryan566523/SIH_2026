# -*- coding: utf-8 -*-
"""Re-validate a deployed model on a new labeled batch + drift check.

Implements condition 5.5 (re-validate every new model version against a
held-out benchmark set before replacing production) and the drift condition
(flag model for review/retraining when live predictions drift from the
training distribution).

Usage:
  python evaluate.py --batch new_samples.csv [--gate] [--drift]
  python evaluate.py --drift-only --batch live_predictions.csv

Batch CSV columns: wallet_id, label (0/1), + the 25 feature columns.
Live-prediction CSV columns: probability (or logit).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from features import FEATURE_NAMES
from shaplib import predict_logit, predict_probability
from train import METRIC_GATES, evaluate, gate_passed


def load_artifacts(artifacts_dir: Path) -> dict:
    model = json.loads((artifacts_dir / "model.json").read_text(encoding="utf-8"))
    manifest = json.loads((artifacts_dir / "manifest.json").read_text(encoding="utf-8"))
    return {"model": model, "manifest": manifest}


def drift_report(expected_mean: float, observed: np.ndarray, threshold: float = 0.15) -> dict:
    obs_mean = float(np.mean(observed))
    shift = abs(obs_mean - expected_mean)
    return {
        "expected_prob_mean": round(expected_mean, 4),
        "observed_prob_mean": round(obs_mean, 4),
        "shift": round(shift, 4),
        "threshold": threshold,
        "flagged": shift > threshold,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Re-validate a deployed model and check drift")
    ap.add_argument("--artifacts", default=str(Path(__file__).parent / "artifacts"))
    ap.add_argument("--batch", required=True, help="CSV with wallet_id,label + 25 feature columns")
    ap.add_argument("--gate", action="store_true", help="enforce metric gates (exit 1 if failed)")
    ap.add_argument("--drift-only", action="store_true", help="only run drift check on a probability CSV")
    args = ap.parse_args()

    art = load_artifacts(Path(args.artifacts))
    model, manifest = art["model"], art["manifest"]

    if args.drift_only:
        df = pd.read_csv(args.batch)
        col = next((c for c in ("probability", "prob", "p") if c in df.columns), None)
        if col is None:
            print("drift-only mode requires a 'probability' column")
            return 2
        d = drift_report(manifest["expected_prob_mean"], df[col].values)
        print(json.dumps(d, indent=2))
        return 1 if d["flagged"] else 0

    df = pd.read_csv(args.batch)
    missing = [n for n in FEATURE_NAMES if n not in df.columns]
    if missing:
        print("missing feature columns:", missing)
        return 2

    X = df[FEATURE_NAMES].values
    y = df["label"].values
    logits = np.array([predict_logit(model, dict(zip(FEATURE_NAMES, row))) for row in X])
    probs = 1.0 / (1.0 + np.exp(-logits))
    metrics = evaluate(y, probs)
    print("metrics:", json.dumps(metrics, indent=2))

    ok, failures = gate_passed(metrics, METRIC_GATES)
    print("gates:", "PASSED" if ok else "BLOCKED", failures if failures else "")
    if args.gate and not ok:
        return 1

    d = drift_report(manifest["expected_prob_mean"], probs)
    print("drift:", json.dumps(d))
    if d["flagged"]:
        print("⚠ drift flagged — model review/retraining recommended")
    return 0


if __name__ == "__main__":
    sys.exit(main())