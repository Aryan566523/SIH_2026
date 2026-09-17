# CONDITIONS.md — CryptoTrace AI (SIH26183) Decision & Trigger Conditions

This document lists every conditional/trigger point the system must implement.
Each condition is written as: **IF <state/input> THEN <required system behavior>.**
These conditions must be encoded in code/config, not left to ad-hoc judgment.

---

## 1. Blockchain Verification Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 1.1 | A transaction is observed from only ONE source | Mark status = `unverified`; do not use in high-confidence evidence |
| 1.2 | Own node AND an independent source agree on tx/block data | Mark status = `verified` |
| 1.3 | Own node and independent source disagree | Mark status = `conflict`; flag for manual reconciliation; do not auto-resolve |
| 1.4 | Transaction confirmations < chain-specific safe-finality depth | Mark status = `pending/confirmed`, not `finalized` |
| 1.5 | A reorg is detected affecting an already-indexed block | Revalidate all transactions in that block before any reuse in evidence/graph |
| 1.6 | Token transfer references a contract address not in the verified token registry | Flag as `unverified token`; do not resolve using symbol/name alone |
| 1.7 | A "balance" claim is made without a specific block reference | Reject/flag as incomplete; require block-anchored state query + supporting transactions |
| 1.8 | RPC/node request fails or times out | Failover to secondary RPC/indexer source automatically; log failure event |
| 1.9 | All available sources for a chain are unreachable | Queue the job for retry; do not fabricate or interpolate data |

---

## 2. Miner / Validator Escalation Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 2.1 | A miner/validator only produced/signed a block containing a suspect transaction | Treat as `infra_node`; do NOT include in fund-flow graph or risk scoring |
| 2.2 | A reorg/double-spend is suspected around the suspect transaction | Escalate miner/validator to active investigation subject |
| 2.3 | The miner/validator address also appears as a direct sender/receiver of funds | Reclassify node from `infra_node` to `wallet_node` for that address's flow activity |
| 2.4 | The miner/validator/pool matches a sanctioned/flagged entity list | Escalate automatically; attach registry match as evidence |
| 2.5 | Abnormal block-time clustering around suspect transactions (possible MEV/collusion) | Flag for manual review; do not auto-conclude collusion |
| 2.6 | A slashing/penalty event correlates in time with the case | Attach as contextual evidence; escalate for review |
| 2.7 | Miner/validator infrastructure overlaps with known mixer/bridge operators | Escalate; treat as service-entity investigation, not routine block-producer activity |
| 2.8 | None of conditions 2.2–2.7 are met | Miner/validator remains `infra_node`; excluded from fraud dashboards and ML scoring |

---

## 3. Graph Traversal Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 3.1 | Requested trace depth/nodes/branches exceed configured synchronous limits | Convert job to asynchronous, queued, checkpointed execution |
| 3.2 | Traversal reaches a node classified as mixer/privacy service | Stop expansion on that branch; record explicit `trace_boundary`; reduce path confidence |
| 3.3 | Traversal reaches a node classified as known VASP/exchange | Mark as candidate terminal node; continue only if amount/time correlation still meets threshold |
| 3.4 | A worker/job crashes mid-traversal | Resume from last checkpoint; do not restart from zero |
| 3.5 | Amount at a hop falls below the configured minimum-amount threshold | Prune that branch from further expansion |
| 3.6 | Time gap between hops exceeds the configured investigation time window | Prune or down-rank that branch |
| 3.7 | A candidate node has already been visited in this trace job | Do not re-expand; reuse cached result |
| 3.8 | Job runtime exceeds configured max runtime | Halt gracefully; return partial results with `incomplete` flag, not silent failure |
| 3.9 | Cross-chain bridge/service is detected in the path | Attempt bridge-registry correlation (asset/time/value); if unmatched, mark as `unconfirmed cross-chain link` |

---

## 4. VASP / Entity Attribution Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 4.1 | Address exactly matches a known-service address in the registry | Return `Confirmed` attribution with source reference |
| 4.2 | Address matches behavioral/clustering pattern but not a direct registry entry | Return `Probable` attribution with supporting pattern evidence |
| 4.3 | No registry match and no strong behavioral pattern | Return `Unknown` — do not guess |
| 4.4 | Matched entity is a custodial/omnibus wallet | Attribute to the service only; explicitly mark individual identity as `not determined` |
| 4.5 | Registry entry is outdated (past defined freshness threshold) | Flag attribution as `stale`, lower confidence accordingly |

---

## 5. AI / ML Scoring Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 5.1 | Model confidence < defined threshold (e.g., <0.6) | Output `UNKNOWN` risk classification instead of forced label |
| 5.2 | Wallet has insufficient transaction history (below minimum feature-support count) | Flag `insufficient data`; do not score with full confidence |
| 5.3 | Node type = `infra_node` (miner/validator) | Do not apply wallet-behavior ML features/scoring |
| 5.4 | A prediction is generated | Attach SHAP (or equivalent) explanation + model version hash — mandatory, not optional |
| 5.5 | New model version is deployed | Re-validate against held-out benchmark set before replacing production model |
| 5.6 | Training/validation data split is being created | Split by wallet/case/time — reject split if same-wallet transactions appear in both train and test |
| 5.7 | Evaluation metrics (precision/recall/F1/ROC-AUC/calibration) fall below defined minimum | Block deployment; require retraining or threshold adjustment |

---

## 6. Evidence Integrity Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 6.1 | New evidence record is created | Generate canonical form → SHA-256 hash → digital signature → store |
| 6.2 | An existing evidence record needs correction | Create a new versioned record; retain and link the original — never overwrite |
| 6.3 | Evidence package hash does not match stored hash on retrieval | Flag as `tamper-suspected`; block use in reports until resolved |
| 6.4 | Evidence is accessed, exported, or modified | Write immutable audit log entry with actor, timestamp, action |
| 6.5 | Evidence lacks required fields (tx hash, block ref, source, timestamps, etc.) | Reject evidence creation; require complete schema before storage |

---

## 7. Security & Access Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 7.1 | A user attempts access without MFA | Deny access |
| 7.2 | A user requests data outside their case-scoped permissions | Deny and log the attempt as a security event |
| 7.3 | Abnormal login pattern detected (geo/time/frequency anomaly) | Trigger security alert; optionally require step-up authentication |
| 7.4 | Bulk export or unusual job-creation volume detected from one account | Trigger alert and rate-limit further actions pending review |
| 7.5 | API request rate exceeds configured threshold per client/key | Apply rate limiting / throttling via gateway |
| 7.6 | Secret/key nearing rotation expiry | Trigger automatic rotation workflow before expiry |

---

## 8. Reliability & Failover Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 8.1 | Primary blockchain node becomes unreachable | Failover to independent RPC/indexer source automatically |
| 8.2 | Primary database becomes unavailable | Failover to replica; trigger point-in-time recovery procedures if needed |
| 8.3 | A backup restoration drill is due (per schedule) | Execute drill; log pass/fail result |
| 8.4 | Worker node fails while processing a queued job | Requeue the job; resume from last checkpoint if available |
| 8.5 | Queue depth exceeds defined threshold | Trigger autoscaling of worker pool |
| 8.6 | Monitoring detects blockchain sync lag beyond threshold | Alert operations team; mark affected data as `stale` until resolved |

---

## 9. Scale & Load Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 9.1 | Same wallet/case is queried again within cache validity window | Serve from cache/shared index instead of re-computing |
| 9.2 | Concurrent investigator sessions exceed current worker capacity | Autoscale trace/ML/report workers independently based on their own queue depth |
| 9.3 | A single deep investigation threatens to consume disproportionate cluster resources | Apply concurrency limits / fair scheduling to cap its resource share |
| 9.4 | System load testing is performed | Must be run at defined concurrency tiers (10/50/100/500/1000) and depth tiers (100 to 200,000 hops) before claiming scale readiness |

---

## 10. Testing Gate Conditions (must pass before deployment)

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 10.1 | A new feature touches blockchain data ingestion | Functional test required: correct parsing of transfers/events/contracts |
| 10.2 | A new feature touches graph traversal | Scale test required at minimum depth tiers defined in test matrix |
| 10.3 | A new feature touches ML scoring | Precision/recall/F1/ROC-AUC/calibration must meet minimum defined thresholds |
| 10.4 | A new feature touches evidence handling | Tamper-detection test (hash/signature mismatch) must pass |
| 10.5 | A new feature touches job processing | Crash/resume test must pass (kill worker mid-job, verify checkpoint resume) |
| 10.6 | Any performance number is to be published/reported | Must be from an actual measured benchmark run, not estimated |

---

## 11. Reporting / Dashboard Display Conditions

| # | Condition (IF) | Required Behavior (THEN) |
|---|---|---|
| 11.1 | Displaying any wallet/case result | Must show three separated sections: verified facts / attribution confidence / AI risk (explainable) |
| 11.2 | Displaying a miner/validator in relation to a case | Must visually separate "block producer" facts from "fund flow" facts unless escalated per Section 2 |
| 11.3 | Displaying a trace that hit a mixer/privacy boundary | Must show explicit boundary marker, not an implied continued path |
| 11.4 | Exporting a legal/forensic dossier | Must include evidence hashes, signatures, and full provenance metadata |
| 11.5 | Displaying an ML risk score | Must display alongside confidence value and top contributing factors (SHAP) — never a bare number |
| 11.6 | Attribution confidence is `Unknown` | Must display as `Unknown`, not omitted or defaulted to a guessed value |

---

## 12. Master Escalation Table (Cross-Cutting)

| Trigger Category | Escalates To |
|---|---|
| Data conflict between sources | Manual reconciliation queue |
| Suspected reorg/double-spend | Blockchain verification review + possible miner/validator escalation |
| Mixer/privacy service entry | Trace boundary marker + reduced confidence |
| Sanctioned entity match (wallet or miner/validator) | Automatic escalation + evidence attachment |
| ML confidence below threshold | `UNKNOWN` output, no forced classification |
| Evidence hash mismatch | Tamper-suspected flag, blocked from report use |
| Security anomaly (login/export/bulk action) | Security alert + possible access throttling |
| Resource monopolization by one job | Concurrency limiting / fair scheduling |





Yes, this is comprehensive and covers ~90% of the meaningful decision points in your architecture. It's genuinely one of the stronger condition-mapping documents I'd expect to see for a project like this — most teams never formalize this at all. But there are a few categories of conditions that are missing or under-specified, and one important caveat about scope vs. effort for an SIH submission.

✅ What's Already Strong
Coverage Area	Status
Blockchain verification/trust	✅ Solid
Miner/validator escalation	✅ Solid (matches earlier discussion)
Graph traversal bounding	✅ Solid
VASP attribution confidence states	✅ Solid
ML confidence/UNKNOWN handling	✅ Solid
Evidence tamper/versioning	✅ Solid
Security/access	✅ Solid
Reliability/failover	✅ Solid
Scale/load	✅ Solid
Testing gates	✅ Solid
Reporting/display separation	✅ Solid
This part is production-grade thinking. Nothing here contradicts the plan or rules docs — it's internally consistent.

⚠️ Gaps Worth Adding
These are real gaps — not nitpicks — because they represent conditions that will occur in a working system and aren't covered above:

1. Case Intake / Input Validation Conditions
IF submitted wallet address fails chain-specific format validation → reject with clear error, do not silently attempt processing
IF the same wallet is reported in multiple open cases → link cases or flag duplicate investigation instead of running redundant jobs
IF reporting user's claimed loss amount doesn't match any on-chain transfer to/from the wallet → flag case as unsubstantiated pending review, don't auto-reject
2. Empty / Low-Signal Result Conditions
IF a wallet has zero transaction history → return no activity found, not low risk (these are NOT the same thing)
IF a wallet exhibits dust-attack-level noise (huge tx count, negligible amounts) → prune from primary trace but retain in raw data with a dust tag
3. Model Lifecycle / Drift Conditions
IF live prediction distribution drifts significantly from training distribution → flag model for review/retraining
IF a new registry (VASP/sanctions list) update changes attribution for existing cases → do not silently reclassify closed cases; flag for review
4. Human Override / Appeal Conditions
IF an investigator disputes an ML risk score or attribution → allow logged override with mandatory justification, preserved alongside original AI output (never delete the original)
IF a case report is exported for legal use → require a named investigator sign-off/approval step, not just system-generated export
5. Data Governance / Retention Conditions
IF a case is closed/archived → apply defined retention rules before any deletion; evidence retention likely needs to outlast case closure
IF cross-agency/jurisdictional access is requested → apply additional authorization checks beyond standard RBAC
6. Chain/Registry Versioning Conditions
IF a chain adapter or node client is upgraded → re-validate a sample of recently indexed data against the new version before trusting new ingestion
IF the VASP/sanctions registry itself is updated → version-stamp it so past attributions remain reproducible against the registry version used at the time
