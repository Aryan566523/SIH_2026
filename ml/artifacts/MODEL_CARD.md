# Model Card — xgb-wallet-v1

Generated: 2026-09-14 11:41 UTC  ·  model.json sha256: `abde6b9fd35714a3261ef10976a4eed33606aaee8e6bdaa219e9623671fd9084`

## Purpose
Wallet-level fraud-flow risk prioritization. AI output is **prioritization,**
never a verdict (RULES.md §0.3). Every prediction ships with a SHAP
explanation, model version and model hash (condition 5.4).

## Model
- Algorithm: XGBoost (binary:logistic), 25 interpretable features
- Feature groups: transaction / behavior / graph / flow-time
- Objective: P(wallet participates in a fraud-flow pattern)

## Training data
- Synthetic labeled wallets: 4000 (1400 fraud, 2600 legit)
- **All synthetic data is labeled `is_synthetic: true`** and is never
  presented as real-world validation.
- Patterns: bridge_hop, direct_theft, exchange_cashout, exchange_user, fan_in, fan_out, mixer_entry, multi_victim, p2p_transfers, peel_chain, rapid_forwarding, salary_income, savings, shopping, split_merge

## Split (leakage-safe)
- Method: by case_id, ordered chronologically by first_seen (wallet/case/time)
- train=2772 val=631 test=597
- Verified: no wallet/case appears in two partitions; time ordering enforced.

## Evaluation (held-out test)
| Metric | Value | Gate |
|---|---|---|
| precision | 1.0 | ≥ 0.7 |
| recall | 1.0 | ≥ 0.7 |
| f1 | 1.0 | ≥ 0.7 |
| roc_auc | 1.0 | ≥ 0.85 |
| false_positive_rate | 0.0 | ≤ 0.15 |
| ece | 0.0018 | ≤ 0.1 |
| n | 597 | ≥ — |
| positive_rate | 0.3417 | ≥ — |

Gate result: **PASSED** (condition 5.7)

## Deployment conditions
- Confidence < 0.6 → `UNKNOWN` (condition 5.1)
- < 3 transactions → `INSUFFICIENT_DATA` (condition 5.2)
- Infra nodes (miner/validator) are never scored (condition 5.3)
- New model versions must re-pass gates on a held-out set (condition 5.5)
- Prediction-distribution drift vs expected mean is monitored (drift check)

## Known limitations
- Trained on synthetic data; real-world validation is the separate Elliptic
  benchmark model. Treat wallet-model scores as demo-grade prioritization.
- Features are wallet-level; graph features use 1-hop entity context.
