# ChainSentinel ML — Wallet Risk Model

Train, evaluate and deploy the explainable XGBoost wallet risk model
(`xgb-wallet-v1`) that powers risk scoring in the API.

## Quick start (Windows / Linux / macOS)

```bash
python ml/setup_and_train.py
```

This single command:
1. checks Python >= 3.10,
2. installs missing dependencies from `ml/requirements.txt` (numpy, pandas,
   scikit-learn, xgboost),
3. trains the model and prints a full success report (metrics, gates, artifacts),
4. exits non-zero if the deployment gates fail (condition 5.7).

Optional flags:

```bash
python ml/setup_and_train.py --n-wallets 8000 --seed 42   # more data
python ml/setup_and_train.py --with-elliptic              # + real-world Elliptic benchmark model
python ml/setup_and_train.py --force                      # export even if gates fail (demo only)
```

## What it produces (`ml/artifacts/`)

| File | Purpose |
|---|---|
| `model.json` | The trained model: 96 XGBoost trees with split thresholds + training cover stats (portable JSON, ~25 KB) |
| `manifest.json` | Model version, SHA-256 hash, feature definitions, metric gates, training split, data provenance |
| `metrics.json` | Held-out test metrics (precision, recall, F1, ROC-AUC, FPR, calibration/ECE) |
| `golden_vectors.json` | Cross-language test vectors: raw txs + features + logit + probability + SHAP values |
| `MODEL_CARD.md` | Model card (documentation, limitations) |

The artifacts are **committed to the repo** so the API works out of the box;
retrain any time with the script above.

## How the API uses it

`apps/api/src/modules/risk/ml-model.ts` loads the artifacts at boot
(`ML_MODEL_PATH`, default `ml/artifacts`), verifies the model SHA-256 against
the manifest, and mirrors the Python feature extraction + exact TreeSHAP in
Node.js — no Python or ONNX runtime needed. `RiskService` uses the ML model
first and falls back to `rules-heuristic-v1` if the artifacts are missing or
invalid.

Conditions implemented (for-implementation/conditions.md):

- **5.1** confidence < 0.6 → `UNKNOWN` (never a forced label)
- **5.2** < 3 transactions → `INSUFFICIENT_DATA`
- **5.3** infra nodes (miner/validator) are never scored
- **5.4** every prediction ships with SHAP explanation + model version + hash
- **5.5/5.7** gates block deployment on weak metrics; `ml/evaluate.py` re-validates
- drift: rolling prediction mean vs training baseline (`expected_prob_mean`)

## Other commands

```bash
python ml/train.py --n-wallets 4000 --seed 42        # train only
python ml/download_data.py --full                    # download Elliptic dataset (690 MB features)
python ml/train.py --with-elliptic                   # train + Elliptic tx-level benchmark model
python ml/evaluate.py --batch new_samples.csv --gate # re-validate on a new labeled batch
python ml/evaluate.py --drift-only --batch probs.csv # drift check only
python -m pytest ml/tests -q                         # run the ML test suite
```

pnpm equivalents: `pnpm ml:setup`, `pnpm ml:train`, `pnpm ml:evaluate`,
`pnpm ml:download`, `pnpm ml:test`.

## Design notes (why JSON, not GGUF/ONNX)

This is a gradient-boosted decision tree model over 25 interpretable
wallet-level features — the baseline mandated by the project spec
(for-implementation/prompt.md §10: "First model: XGBoost / LightGBM").
GGUF is a format for quantized transformer LLMs; it is neither trainable with
the available data nor needed for a 25 KB tree ensemble. JSON is chosen
because:

- the NestJS API can load and execute it directly (tree walking + TreeSHAP),
- SHAP explanations require the tree structure + training cover stats,
- it is human-readable, hashable and versioned — court-defensible and auditable.

## Data provenance

- Training data is **synthetic and clearly labeled** (`is_synthetic: true`):
  deterministic fraud-flow patterns (rapid forwarding, peel chains, fan-in/out,
  split/merge, mixer entry, bridge hops, exchange cash-out, multi-victim) vs
  legitimate behavior. It is never presented as real-world validation.
- The optional Elliptic benchmark model is trained on the real-world Elliptic
  Bitcoin dataset (download via `ml/download_data.py`) as a **separate** model —
  never mixed into the synthetic model's training data.
- Splits are leakage-safe: by case, ordered chronologically by first_seen
  (condition 5.6); verified by tests (`ml/tests/test_split.py`).