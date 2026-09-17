# CryptoTrace AI - Implementation Scope

## 1. Purpose

Build a case-scoped investigation platform that helps authorized investigators trace reported cryptocurrency flows, verify blockchain facts, identify likely services, prioritize suspicious activity, and produce reproducible evidence packages.

The platform supports investigation and prioritization. It does not determine criminal guilt, prove individual ownership of an address, or predict future fund movement.

## 2. In Scope

### 2.1 Case intake and access

- Create and manage investigation cases.
- Validate wallet addresses against the selected chain format.
- Record reported loss, source information, chain, wallet, and case metadata.
- Detect duplicate wallet/case investigations and link or reuse existing work.
- Enforce MFA, RBAC, least privilege, and case-scoped authorization.
- Log denied access, anomalous login activity, bulk actions, and unusual job creation.

### 2.2 Blockchain acquisition and verification

- Start with TRON/TRC-20 and keep the adapter contract compatible with Ethereum/EVM chains.
- Use a common chain-adapter interface for nodes, RPC providers, and indexers.
- Ingest native transfers, token transfers, receipts, contract events, internal transactions where available, blocks, balances, and finality data.
- Tag ingested data with chain ID, source, collection time, synchronization state, producer address/type, and consensus metadata.
- Cross-check critical data using an independently controlled node and an independent RPC/indexer source.
- Track `pending`, `confirmed`, `finalized`, `unverified`, and `conflict` states.
- Detect reorgs and revalidate affected blocks and transactions before reuse.
- Validate tokens by chain and contract address, never by symbol or name alone.
- Support block-anchored historical balance queries with supporting transfers.
- Fail over between blockchain sources, retry unavailable work, and preserve failure events.

### 2.3 Shared indexing and normalized data

- Store a canonical normalized dataset for blocks, transactions, addresses, token transfers, contracts, events, sources, and evidence links.
- Maintain incremental synchronization and synchronization-lag monitoring.
- Reuse indexed and cached data for repeated wallet or case queries.
- Version registry data, software/indexer versions, and collection metadata for reproducibility.

### 2.4 Fund-flow graph and tracing

- Model wallet, service, and infrastructure nodes separately.
- Support fan-in, fan-out, split, merge, repeated forwarding, service boundaries, and cross-chain transitions.
- Store token, amount, timestamp, block, contract, source, and evidence metadata on graph edges.
- Use bounded priority traversal based on amount, time, forwarding ratio, graph distance, suspicious neighbors, and service proximity.
- Enforce maximum depth, nodes, branches, amount threshold, time window, and runtime limits.
- Queue, checkpoint, and resume investigations that exceed synchronous limits.
- Cache visited nodes and avoid re-expanding them within a trace job.
- Mark mixer/privacy-service entry as an explicit `trace_boundary` and reduce path confidence.
- Correlate bridge activity using asset, time, and value; mark unmatched links as unconfirmed.
- Preserve dust activity in raw data while pruning it from primary analysis when appropriate.

### 2.5 Miner and validator handling

- Treat miners, validators, and pools as `infra_node` by default.
- Keep block-producer facts separate from fund-flow facts in the graph, dashboard, and reports.
- Escalate infrastructure only for reorg/double-spend indicators, direct fund-flow participation, sanctioned status, abnormal clustering, correlated penalties, or suspicious shared infrastructure.
- Do not apply wallet-behavior ML features to infrastructure nodes.
- Maintain a miner, validator, and pool registry alongside service registries.

### 2.6 VASP and entity attribution

- Maintain a provenance-aware, versioned registry of known services, exchanges, bridges, mixers, and sanctioned entities.
- Return `Confirmed`, `Probable`, or `Unknown` attribution with source and registry-version references.
- Attribute custodial or omnibus addresses to the service only unless separate identity evidence exists.
- Mark stale registry matches and preserve historical attribution results when registries change.
- Treat behavioral clusters as prioritization evidence, not proof of common ownership.

### 2.7 AI/ML risk prioritization

- Begin with an interpretable XGBoost or LightGBM baseline.
- Use transaction, behavioral, graph, flow, timing, and service-proximity features.
- Split training, validation, and test data by wallet, case, and time to prevent leakage.
- Return a risk association score, confidence, top contributing factors, model version, and model hash.
- Use SHAP or an equivalent explanation for every prediction.
- Return `UNKNOWN` and `insufficient data` when confidence or feature support is inadequate.
- Exclude infrastructure nodes from wallet-behavior scoring.
- Block model deployment when precision, recall, F1, ROC-AUC, false-positive rate, calibration, or drift checks fail defined thresholds.
- Preserve original AI results when an investigator applies a justified, logged override.

### 2.8 Evidence and reporting

- Create canonical evidence records containing transaction hash, block number/hash, from, to, token contract, amount, timestamp, finality/status, source, collection time, and software/indexer/model versions.
- Generate a SHA-256 hash and digital signature for each evidence package before storage.
- Use append-only, versioned evidence records; corrections must retain and link the original.
- Verify hashes on retrieval and block tamper-suspected evidence from reports until resolved.
- Maintain immutable audit logs for evidence creation, access, export, and version changes.
- Require named investigator approval before legal/forensic export.
- Display every result in separate sections: verified facts, attribution confidence, and explainable AI risk.
- Visually mark trace boundaries and keep infrastructure facts separate from fund-flow facts.
- Include hashes, signatures, and complete provenance in dossier exports.

### 2.9 Reliability, security, and scale

- Use asynchronous queues and separate trace, ML, and report worker pools.
- Resume queued jobs from checkpoints after worker failure.
- Support database replication, point-in-time recovery, protected backups, and scheduled restore drills.
- Monitor RPC availability, node lag, queue depth, worker failures, database latency, storage, and source latency.
- Autoscale worker pools independently and apply fair scheduling and concurrency limits.
- Protect public endpoints with TLS, WAF/API gateway controls, rate limiting, input validation, quotas, encryption, secrets management, and key rotation.

## 3. Out of Scope

- Declaring a person or wallet criminal, guilty, or legally responsible.
- Proving the real-world identity of an address from blockchain behavior alone.
- Treating a commercial API response as proof without independent verification.
- Predicting future fund movement.
- Treating a miner or validator as suspicious solely because it produced a block containing a suspect transaction.
- Applying wallet-behavior ML scoring to infrastructure nodes.
- Resolving a mixer or privacy-service boundary into an invented destination.
- Unbounded or brute-force graph expansion.
- Storing private keys, credentials, or other secrets in source control.

## 4. Delivery Stages

1. **Foundation:** preserve the existing UI/integrations, establish normalized schemas, authentication, case intake, and the chain-adapter interface.
2. **TRON ingestion:** implement TRON/TRC-20 acquisition, indexing, source failover, synchronization, and independent verification.
3. **Investigation engine:** implement graph construction, bounded tracing, checkpoints, caching, service boundaries, and cross-chain correlation.
4. **Attribution and infrastructure:** implement VASP/entity and miner/validator registries, provenance, confidence states, and escalation rules.
5. **Risk and evidence:** implement baseline ML with explanations, model lifecycle controls, signed evidence, audit logs, and dossier export.
6. **Operations:** implement security hardening, replicas/backups, monitoring, autoscaling, restore drills, and production runbooks.
7. **Validation:** complete functional, integrity, failure-recovery, ML, and measured scale testing before deployment claims.

## 5. Definition of Done

- [ ] Blockchain facts, attribution, identity, and AI risk remain separate in code and UI.
- [ ] Critical findings are independently verified or clearly marked unverified/conflicted.
- [ ] Unknown and incomplete results are represented explicitly; no confidence is fabricated.
- [ ] Long-running work is queued, checkpointed, resumable, and resource-limited.
- [ ] Evidence is canonicalized, hashed, signed, append-only, versioned, and audit-logged.
- [ ] Reports include provenance, confidence, limitations, and investigator approval where required.
- [ ] Security, failover, reorg, worker-resume, database-recovery, and tamper-detection tests pass.
- [ ] ML evaluation and scale results are measured, reproducible, and documented.
- [ ] No secrets are committed and no prohibited identity or guilt claims appear in output.

## 6. Required Test Gates

- Blockchain parsing, token-contract validation, finality, source conflict, failover, and reorg tests.
- Graph traversal tests across depth, node, branch, amount, time, mixer-boundary, bridge, cache, and checkpoint limits.
- Miner/validator metadata tagging and escalation tests.
- Attribution tests for confirmed, probable, unknown, stale, custodial, and versioned registry results.
- ML tests for leakage-safe splits, explanations, low confidence, insufficient data, drift, and metric thresholds.
- Evidence tests for canonical hashing, signature mismatch, append-only versioning, audit logs, and export approval.
- Security and recovery tests for MFA, authorization, rate limits, worker crashes, database failover, and backup restoration.
- Measured load tests at concurrency tiers 10, 50, 100, 500, and 1000, with depth tiers from 100 to 200,000 hops.

