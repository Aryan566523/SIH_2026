# RULES.md — CryptoTrace AI (SIH26183) Development & Design Rules

These rules are binding for all code, architecture decisions, ML models, data handling,
and documentation produced for this project. If a proposed change conflicts with a rule
below, the rule wins unless explicitly revised here.

---

## 0. Non-Negotiable Core Principles

1. **Blockchain facts ≠ Attribution ≠ Identity.** These are three separate layers of
   confidence. Never collapse them into a single conclusion.
2. **The API is a source, not proof.** Every critical finding must be cross-verified
   against an own node AND at least one independent source before being marked "verified."
3. **AI produces prioritization, never a verdict.** No ML output may be presented as
   a fraud determination. Every score must ship with a confidence value and explanation
   (SHAP or equivalent).
4. **"Unknown" is a valid, required output.** Never force a confident answer when
   evidence is insufficient. Confidence must degrade gracefully.
5. **Evidence is append-only.** Never mutate an existing evidence record. Corrections
   create a new version and preserve the old one.
6. **Long-running work is asynchronous.** Any graph trace, deep investigation, or
   batch job must be queued, checkpointed, and resumable — never a blocking synchronous call.
7. **Shared indexing over repeated scanning.** No component may re-query raw chain
   data for information that already exists in the shared indexed dataset.

---

## 1. Blockchain Data Rules

- All ingested transactions/blocks/events MUST be tagged with: `chain_id`, `source`,
  `collection_time`, `sync_state`.
- Every chain integration MUST go through a common adapter interface (no direct,
  one-off provider calls scattered through business logic).
- Transaction state MUST be tracked through: `pending → confirmed → finalized`.
  Nothing above "confirmed" may be used for high-confidence evidence until finality
  or reorg-safe depth is reached.
- Token identity MUST be validated by **chain + contract address**, never by symbol
  or name alone (prevents fake-token spoofing).
- Historical balance claims MUST be backed by a state query at a specific block number
  PLUS the transactions that explain the change — a bare "current balance" is insufficient.
- Reorg handling is mandatory: any block/transaction affected by a detected reorg MUST
  be revalidated before reuse in evidence or graph data.

---

## 2. Miners / Validators Rules

- Miners/validators are **infrastructure by default** — never assign fraud-association
  risk to a miner/validator solely for including/producing a suspect transaction's block.
- Every ingested block/transaction MUST carry `producer_address`, `producer_type`
  (miner / validator / pool), and `consensus_metadata` (slot, epoch, difficulty, etc.)
  regardless of whether the miner is under investigation.
- Miner/validator addresses MUST be modeled as a distinct graph node type (`infra_node`),
  separate from `wallet_node` and `service_node`.
- A miner/validator may only be escalated into active investigation when at least ONE
  independent trigger is present:
  - suspected reorg/double-spend around the suspect transaction
  - the address also appears as a direct fund-flow participant (not just block producer)
  - known sanctioned/flagged mining pool or validator entity
  - abnormal block-time clustering suggesting collusion/MEV abuse
  - slashing/penalty event correlated with the case
  - shared operator infrastructure with mixers/bridges
- Wallet-style ML features (holding time, forwarding %, fan-in/out) MUST NOT be applied
  to miner/validator nodes — they require separate consensus-behavior features if scored at all.
- Dashboards/reports MUST visually and semantically separate "block producer" facts from
  "fund flow" facts. A miner never appears in a fund-flow diagram unless escalated per
  the triggers above.

---

## 3. Transaction Graph Rules

- Graph MUST support: fan-in, fan-out, splitting, merging, repeated forwarding, service
  boundaries, and cross-chain transitions as first-class patterns.
- Every edge MUST store: token, amount, timestamp, block, contract, source, evidence link.
- Multi-hop traversal MUST be bounded by: max depth, max nodes, max branches, amount
  threshold, time window, and runtime limit. Brute-force full expansion is prohibited.
- Traversal MUST use priority ranking (amount significance, forwarding ratio, time
  proximity, suspicious neighbours, graph distance, VASP proximity) — not naive BFS/DFS
  over the entire reachable set.
- Any trace exceeding a configured node/depth threshold MUST run as an asynchronous,
  checkpointed job — never inline in a request/response cycle.
- When a trace enters a mixer or privacy service, the system MUST record an explicit
  **trace boundary** and reduce confidence — it must never fabricate a continued path.

---

## 4. VASP / Entity Attribution Rules

- Attribution MUST return one of three states: `Confirmed`, `Probable`, `Unknown` —
  never a bare boolean.
- A custodial/omnibus exchange wallet MUST be attributed to the **service**, not to
  any individual customer, unless independent identity evidence exists.
- Every attribution MUST carry provenance: what matched (address list, behavioral
  pattern, cluster) and the registry version/timestamp used.
- Cluster membership (e.g., "likely part of scam wallet cluster") is a prioritization
  signal only — it MUST NOT be presented as proof of common ownership.

---

## 5. AI / ML Rules

- Baseline model: XGBoost or LightGBM. GNN/GraphSAGE/GAT only after the graph +
  labeling pipeline is stable and validated.
- Every prediction MUST ship with a SHAP (or equivalent) explanation of top contributing
  features — no black-box score without justification.
- Models MUST be versioned and hashed; every stored prediction MUST record the exact
  model version used to produce it.
- Train/test/validation splits MUST be by wallet/case/time — never random-row splits
  that leak near-duplicate transactions from the same wallet across splits.
- Required evaluation metrics before any deployment: precision, recall, F1, ROC-AUC,
  false-positive rate, calibration. No model ships on accuracy alone.
- Synthetic training data must be clearly labeled as synthetic and never silently mixed
  into reported "real-world validated" performance numbers.
- When confidence is below the defined threshold, output MUST be `UNKNOWN` rather than
  a forced classification.

---

## 6. Evidence Integrity Rules

- Every evidence record MUST include: tx hash, block number/hash, from, to, token
  contract, amount, timestamp, finality/status, source, collection time, software/
  indexer/model version.
- Every evidence package MUST be hashed (SHA-256) and digitally signed before storage.
- Evidence storage is **append-only**. No in-place edits — corrections create new,
  linked versions with a full audit trail.
- All access, export, and modification-version events on evidence MUST be logged in
  an immutable audit log.

---

## 7. Security Rules

- MFA + RBAC + least privilege + case-scoped access control are mandatory for all
  investigator accounts — no shared/global admin access to case data.
- All traffic MUST use TLS; all data at rest MUST be encrypted.
- Secrets MUST live in a secrets manager with rotation — never hardcoded or committed
  to source control.
- All external-facing endpoints MUST sit behind a WAF/API gateway with rate limiting
  and input validation.
- Every security-relevant event (login anomalies, permission changes, unusual exports,
  bulk job creation) MUST generate an alertable audit entry.

---

## 8. Reliability & Scale Rules

- No single point of failure for blockchain access — minimum of own node + one
  independent RPC/indexer source, with automatic failover.
- Database MUST run with replication and point-in-time recovery; backups MUST be
  immutable/protected and restore-tested on a regular schedule.
- Long-running jobs MUST checkpoint progress so a crash resumes rather than restarts.
- System MUST scale horizontally via queue + worker pools (trace workers, ML workers,
  report workers kept separate) — vertical scaling alone is not an acceptable design.
- Repeated queries on the same wallet/case MUST hit cache/shared index rather than
  re-triggering full re-computation.
- No single deep investigation may be allowed to monopolize cluster resources —
  concurrency limits and fair scheduling are required.

---

## 9. Testing Rules

- No feature ships without: functional tests, at least one data-integrity/failure test,
  and (if applicable) a scale test at a defined concurrency level.
- Failure-mode tests are mandatory for: RPC outage, worker crash, DB failover, reorg,
  and interrupted job resume — these are not optional "nice to have" tests.
- Only measured, reproducible benchmark numbers may be published or reported —
  no theoretical/estimated performance claims in documentation or demos.

---

## 10. Documentation & Reporting Rules

- Every investigator-facing report MUST clearly separate three sections: **on-chain
  facts (verified)**, **attribution (confidence-scored)**, and **AI risk assessment
  (explainable, non-binding)**.
- Legal/forensic dossier exports MUST include evidence hashes/signatures and provenance
  metadata, not just human-readable summaries.
- Any documentation describing system capability MUST state assumptions/limits (e.g.,
  "mixer entry = trace boundary, not dead end") rather than implying full traceability
  in all cases.

---

## 11. Explicit Prohibitions

- ❌ Never label a wallet/person as "criminal" or "guilty" in any system output.
- ❌ Never treat a commercial API response as final proof without independent verification.
- ❌ Never assign an individual identity to a custodial/omnibus wallet without separate
  identity evidence.
- ❌ Never silently drop confidence/uncertainty information when displaying results.
- ❌ Never run unbounded/brute-force graph expansion in production.
- ❌ Never store secrets, private keys, or credentials in source control.
- ❌ Never apply wallet-behavior ML scoring to miner/validator infrastructure nodes.
- ❌ Never present a mixer/privacy-service boundary as a resolved destination.

---

## 12. Definition of Done (applies to every merged feature)

A feature is NOT done until:
- [ ] It respects the layer separation (facts / attribution / risk / identity).
- [ ] It has confidence/uncertainty handling built in (no forced answers).
- [ ] Evidence-impacting changes are hashed, signed, and audit-logged.
- [ ] It has functional + failure-mode test coverage.
- [ ] It scales via async/queue pattern if it can be long-running.
- [ ] It is documented with explicit assumptions and limits.