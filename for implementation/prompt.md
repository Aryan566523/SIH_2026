# SIH26183 — Complete Project Implementation Plan
**CryptoTrace AI — Automated Blockchain Analytics for Fraud-Linked Cryptocurrency Investigation**

*Standalone implementation blueprint covering the complete system: wallet intake, blockchain verification, transaction indexing, graph-based fund tracing, VASP/entity attribution, AI/ML, evidence integrity, cross-chain analysis, security, scale, failure recovery, testing, compute, cost and production deployment.*

> **Core principle:** blockchain verification establishes on-chain facts; graph analytics reconstructs fund flows; VASP/entity analytics identifies likely service relationships; AI prioritizes suspicious activity; evidence provenance makes results reproducible; authorized investigators make the final investigative/legal decision.

---

## 1. Project Objective

Take a victim-reported suspect wallet/address and determine:
- Where assets moved
- The current or historical on-chain status
- Which wallets/services are associated with the flow
- Whether a likely VASP/exchange can be identified
- How suspicious the flow is
- What evidence supports each important conclusion

**The system is NOT intended to:**
- Predict future money movement
- Automatically declare a real person a criminal
- Treat an ML score as legal proof

---

## 2. What the System Must Answer

| Question | System Response |
|---|---|
| Where did the money go? | Reconstruct verified transaction paths and graph relationships |
| Is the money still there? | Query state/balance at a known block and preserve supporting transfers |
| Can the transfer be independently verified? | Cross-check critical data against an own node and independent sources |
| Who/what is the destination? | Separate wallet facts, service attribution and real-world identity |
| Is the wallet suspicious? | Use explainable ML plus graph/flow conditions to prioritize investigation |
| Can the investigator prove it later? | Create tamper-evident, provenance-rich evidence packages |

---

## 3. Complete System Architecture

```
Victim / Case Intake
        ↓
API Gateway + Authentication
        ↓
Investigation Job Manager
        ↓
Blockchain Acquisition Layer
(Own Nodes + Independent RPC / Indexer Sources)
        ↓
Verification + Normalization
        ↓
Blockchain Indexer
        ↓
Shared Transaction / Address Data
        ↓
Transaction Graph + Fund-Flow Engine
        ↓
VASP / Entity Attribution
        ↓
AI/ML Risk + Explainability
        ↓
Evidence Engine (hash/sign/audit)
        ↓
Investigator Dashboard + Legal / Forensic Dossier
```

---

## 4. Architecture Principles

- **API is a source, not the proof.** Critical findings need independent verification.
- **Blockchain facts and attribution are separate.** A verified transaction does not automatically prove who controls an address.
- **AI is prioritization, not a verdict.** ML produces risk/association scores and explanations.
- **Deep investigations are jobs, not synchronous requests.** Long graph traces are queued, checkpointed and resumable.
- **Shared indexing is mandatory for scale.** Investigators reuse indexed blockchain data instead of repeatedly scanning the chain.
- **Unknown is a valid result.** Lower confidence when evidence is insufficient rather than inventing an answer.

---

## 5. Phase-by-Phase Implementation Roadmap

### Phase 0 — Baseline Existing Prototype
- Keep the existing UI and working wallet/API integrations
- Separate UI logic from provider logic so the data layer can expand
- Introduce a normalized internal schema before ML

### Phase 1 — Chain Abstraction and Ingestion
- Create common adapters for wallet data, transactions, token transfers, blocks, state/balances, receipts and contract events
- Start TRON/TRC-20 first; keep Ethereum/EVM-compatible interfaces ready
- Record chain ID, source, collection time and synchronization state

### Phase 2 — Blockchain Data Acquisition
- Connect to an independently controlled node where practical
- Use independent RPC/indexer sources for redundancy and cross-checking
- Capture native transfers, token transfers, receipts/status, contract logs/events and relevant internal transactions

### Phase 3 — Independent Verification
- Cross-check critical transactions against own node and an independent source
- Track pending → confirmed → finalized/revalidated states
- Reconcile indexed blocks against canonical node block hashes/heights

### Phase 4 — Local Indexing
- Build the shared canonical analytics dataset
- Index addresses, transactions, token transfers, contracts, blocks, events and VASP/entity labels
- Run incremental synchronization for new blocks

### Phase 5 — Graph Construction
- Represent address → transaction → address as a directed property graph
- Store token, amount, timestamp, block, contract, source and evidence metadata
- Support fan-in, fan-out, split, merge, repeated forwarding and service boundaries

### Phase 6 — Multi-Hop Tracing
- Use bounded priority traversal rather than brute-force exploration
- Rank paths using amount significance, forwarding ratio, time relationship, suspicious neighbours, graph distance and VASP proximity
- Add maximum depth, nodes, branches, amount threshold, time window and runtime limits
- Make deep investigations asynchronous and checkpointed

### Phase 7 — VASP / Entity Attribution
- Create a provenance-aware registry of known service addresses/entities
- Combine address matching, behavioral clustering and transaction patterns
- Return Confirmed / Probable / Unknown confidence states
- Do not equate a custodial/omnibus wallet with an individual identity

### Phase 8 — AI/ML Risk Engine
- Start with XGBoost or LightGBM
- Use SHAP to explain important risk contributors
- Return risk and confidence, not a binary accusation
- Version/hash model artifacts and record the model version

### Phase 9 — Evidence Engine
- Create canonical evidence objects
- Store TX hash, block number/hash, from/to, token contract, amount, timestamp, finality/status, source and collection time
- Hash evidence packages with SHA-256 and digitally sign them
- Make evidence append-only; updates create a new version

### Phase 10 — Cross-Chain Analysis
- Maintain a bridge/service registry
- Correlate source/destination activity with asset mapping, value and timing
- Show an explicit trace boundary when correlation is uncertain

### Phase 11 — Security
- MFA, RBAC, least privilege and case-scoped authorization
- TLS, encryption at rest, secrets management and key rotation
- WAF/API gateway, rate limiting, validation and quotas
- Immutable audit logging

### Phase 12 — Reliability, Backup and Disaster Recovery
- Retry and checkpoint long-running jobs
- Use multiple RPC sources and automatic failover
- Database replicas and point-in-time recovery
- Protected/immutable backup copies with tested restoration
- Monitor node lag, queue depth, worker failures, DB latency, storage and RPC latency

### Phase 13 — 1,000+ Investigator Scaling
- API gateway + load balancing + asynchronous queue
- Separate trace, ML and report workers
- Reuse indexed/cache data for repeated investigations
- Scale workers horizontally from measured queue depth and throughput

### Phase 14 — Testing and Benchmarking
- Functional tests for chain data, graph traversal, VASP lookup and evidence
- Failure tests for RPC outage, worker crash, DB failover, reorg and interrupted jobs
- ML tests for precision, recall, F1, ROC-AUC, false positives and calibration
- Scale tests for concurrent investigators and deep graph jobs
- Publish only measured performance results

### Phase 15 — Dashboard and Reporting
- Case view, wallet profile, verified transactions, graph, trace path, VASP attribution, risk, evidence quality and provenance
- Provide forensic/legal dossier export
- Keep evidence quality separate from fraud risk and identity attribution

### Phase 16 — Production Hardening
- Define operational targets, alerts, runbooks and incident response
- Security/dependency scanning, penetration testing and restore drills
- Document chain adapters, data lifecycle, model lifecycle, evidence lifecycle and deployment

---

## 6. Blockchain Verification Model

```
Transaction observed
        ↓
Own node / trusted local source
        +
Independent RPC / indexer source
        ↓
Cross-check block + transaction + receipt/event data
        ↓
Reconciliation / finality state
        ↓
VERIFIED EVIDENCE RECORD
```

Critical evidence should include: transaction hash, block number/hash, from, to, token contract, amount, timestamp, status/finality, source, collection time, software/indexer version and evidence-package hash.

> **Historical-balance rule:** "current balance" alone is insufficient. Where supported, query state at a specific block and preserve the transactions explaining later changes.

---

7. Miners / Validators — Role, Investigation Criteria & Technical Handling
7.1 Baseline Position
Miners (PoW) and validators (PoS/DPoS) are network infrastructure, not transaction participants in the fraud sense. They validate and order transactions but do not typically control, receive, or benefit from the funds passing through blocks they produce. By default:

A miner/validator that included a fraudulent transaction in a block is not treated as a suspect.
Their presence in a transaction's metadata (block producer, validator signature) is recorded as contextual evidence only, not flow evidence.
7.2 When Miners/Validators DO Require Investigation
Escalate a miner/validator into an active investigation thread only when there is an independent, evidence-backed trigger, such as:

Trigger	Why it matters
Suspected chain reorganization / double-spend around the suspect transaction	May indicate deliberate manipulation to reverse or hide a transfer
Miner/validator address also appears as a fund-flow participant (not just block producer)	Converts them from infrastructure to a graph node like any wallet
Known sanctioned/flagged mining pool or validator entity	Regulatory/compliance relevance
Unusual block-time clustering around suspect transactions	Possible collusion or transaction-ordering abuse (MEV-style front-running/sandwiching)
Validator slashing/penalty events correlated with the case	Signals protocol-level misbehavior tied to the investigation
Infrastructure reuse — same operator running nodes, mixers, or bridges	Indicates the "miner" is actually operating additional suspicious services
7.3 Data to Collect (When Escalated)
Miner/validator address(es) and pool/operator identity (if publicly known)
Block(s) produced, timestamps, and block reward/fee transactions
Historical block production rate and stake/hash-power share
Any direct wallet-to-wallet transfers involving the miner/validator address (separate from block-reward activity)
Slashing, penalty, or consensus-fault records (PoS chains)
Reorg depth and affected transaction list, if a reorganization is involved
7.4 Technical Integration into the Architecture
Chain adapters (Phase 1/2) must tag each transaction/block with producer_address, producer_type (miner/validator/pool), and consensus_metadata (e.g., slot, epoch, difficulty) as part of normalized ingestion — even when not actively investigated, so the data is available if a trigger occurs later.
Verification layer (Phase 3) cross-checks block producer identity and reorg status using the own node + independent source, same as any other blockchain fact.
Graph model (Phase 5): miner/validator addresses are stored as a distinct node type (infra_node) separate from wallet_node and service_node. They are only pulled into an active trace path if Section 7.2 criteria are met — this prevents every transaction's graph from being polluted with irrelevant block-producer edges.
VASP/Entity registry (Phase 7) is extended to also hold a Miner/Validator/Pool registry (known pools, staking providers, sanctioned infrastructure lists) so attribution logic can flag known entities automatically.
Evidence engine (Phase 9): if a miner/validator becomes part of the case, its block production and any direct transfers get the same hash/sign/provenance treatment as wallet evidence.
7.5 Red Flags Specific to Miner/Validator Analysis
Repeated block production immediately before/after suspect transactions from the same pool
Validator receiving direct transfers from suspect wallets outside normal reward mechanics
Reorg attempts coinciding with large suspect transfers
Mining pool addresses overlapping with known mixer/bridge operator addresses
7.6 Explicit Non-Goals
Do not assign risk scores to miners/validators using the same ML features as wallets (transaction behavior features don't apply the same way to block producers).
Do not treat "miner processed this transaction" as any form of association with the fraud in dashboards or reports — this must be visually and semantically separated from fund-flow attribution to avoid investigator misinterpretation.
Touchpoints to Update Elsewhere in the Plan
Section	Update
Section 3 (Architecture)	Add "Miner/Validator Metadata Tagging" as a sub-step inside Blockchain Acquisition Layer / Verification
Section 6 (Verification Model)	Include producer_address and consensus metadata as part of the verified evidence record schema
Section 8 (Graph Model)	Note the distinct infra_node type alongside wallet/service nodes
Section 12 (Hard Cases table)	Already has a row for reorgs — add a second row: "Miner/validator suspected of manipulation" → Escalate via Section 7.2 triggers; treat as infra_node upgraded to active investigation subject
Section 17 (Data/Services Layout)	PostgreSQL scope expands to include the Miner/Validator/Pool registry
Section 20 (Testing Matrix)	Add a functional test: "reorg detection + miner/validator metadata tagging accuracy"
Section 22 (Q&A)	Already includes "Do miners/validators need to be investigated?" — keep, now backed by the fuller Section 7
Section 25 (Definition of Done)	Add checklist item: "Miner/validator metadata is captured and reorg-triggered escalation logic is demonstrated"

---

## 8. Transaction Graph Model

```
Victim
  ↓
Wallet A
  ↓
Wallet B
 ↙   ↘
C     D
↓     ↓
Exchange  Bridge
          ↓
     Destination chain
```

The graph must support fan-in, fan-out, splitting, merging, repeated forwarding, service boundaries and cross-chain transitions.

---

## 9. 5,000–200,000-Hop Scalability Strategy

> **Key rule:** never synchronously expand every possible path. Use priority traversal + pruning + caching + queues + checkpoints.

| Condition Group | Examples |
|---|---|
| Amount | minimum amount, forwarded percentage, amount similarity |
| Time | holding time, receive→send delay, investigation window |
| Graph | distance, suspicious neighbours, cluster relation, fan-in/fan-out |
| Service | VASP/exchange/bridge/mixer proximity |
| Risk | ML score, known fraud-cluster relationship |
| Complexity | max nodes, branches, depth, runtime |

A theoretical 10,000-investigation × 200,000-hop workload can create billions of possible graph visits. Indexing, caching, pruning, asynchronous queues and parallel workers are therefore architectural requirements.

---

## 10. AI/ML Training Plan

**First model:** XGBoost / LightGBM. **Explainability:** SHAP. **Later:** GNN / GraphSAGE / GAT after the graph and label pipeline is reliable.

| Group | Initial Features |
|---|---|
| Transaction | amount received, amount sent, transaction count, unique senders, unique receivers |
| Behaviour | average holding time, median holding time, forwarding percentage, activity frequency, fan-in, fan-out |
| Graph | distance from reported wallet, suspicious-neighbour count, fraud-cluster similarity, VASP/service proximity, graph centrality |
| Flow/Time | time correlation, amount correlation, repeated movement, fund splitting, fund merging |

**Additional guidance:**
- Use roughly 20–25 strong, interpretable features initially
- Training data: confirmed/labelled fraud cases where available + known legitimate behavior + synthetic fraud graphs + curated investigation cases
- Synthetic patterns: direct theft, rapid forwarding, peel chains, fan-out, fan-in, split/merge, bridge use, mixer entry, exchange cash-out and multi-victim flows
- Split by wallet/case/time to prevent leakage; do not randomly split nearly identical transactions from the same wallet
- Outputs: fraud-flow association probability + confidence + top contributing signals; keep UNKNOWN when evidence is weak
- Evaluation: precision, recall, F1, ROC-AUC, false-positive rate and calibration

---

## 11. VASP / Entity Attribution

```
Address
  ↓
Known-service/address evidence
  +
Behavioral pattern
  +
Cluster relationships
  +
Deposit/withdrawal pattern
  ↓
Likely entity / VASP
  ↓
Confidence + provenance
```

> **Important:** "wallet is associated with Exchange X" is not the same as "Person X owns the wallet". Omnibus/custodial wallets require service-level attribution and explicit identity uncertainty.

---

## 12. Hard Cases and Required Solutions

| Problem | Required Solution |
|---|---|
| API failure / rate limit | Own node, secondary providers, cache and queue |
| Blockchain reorg | Track pending/confirmed/finalized and revalidate evidence |
| Historical balance | Historical state indexed by block / archive-capable data |
| Smart-contract transfer | Decode token events, contract/internal calls and logs |
| Token spoofing | Validate chain + contract address, not symbol |
| Funds split | Graph fan-out and amount-flow tracking |
| Funds merge | Track multiple origins; reduce certainty when provenance is ambiguous |
| Mixer/privacy service | Declare trace boundary; never invent endpoint |
| Cross-chain bridge | Bridge registry + asset/time/value correlation |
| Exchange omnibus wallet | Attribute service, not automatically customer |
| Dust attack | Low-value/low-relevance pruning while retaining raw data |
| False report | Evidence-first scoring; no immediate scam label |
| Many scam wallets | Candidate clustering/prioritization; cluster ≠ ownership proof |
| Server crash | Checkpoint + retry + resume |
| Database loss | Replica + point-in-time recovery + protected backup |
| Platform hack | MFA/RBAC/WAF/segmentation/encryption/audit |
| 1,000 investigators | Shared index + queue + horizontal workers + caching |
| 10,000 investigations | Async queue + quotas + prioritization + autoscaling |
| 200,000-hop case | Deep async job + bounded traversal + pruning + checkpoints |

---

## 13. Evidence Integrity Model

```
Evidence record
      ↓
Canonical normalized representation
      ↓
SHA-256 hash
      ↓
Digital signature
      ↓
Protected / immutable storage
      ↓
Audit log of access / export / version
```

| Field | Purpose |
|---|---|
| Transaction hash | Reference to the on-chain transaction |
| Block number/hash | Anchors event to blockchain state |
| From / To | Identifies involved addresses |
| Token contract | Prevents symbol-only ambiguity |
| Amount | Defines transferred value |
| Timestamp | Supports temporal analysis |
| Finality/status | Shows confirmation/reliability state |
| Source | Shows where data came from |
| Collection time | Makes freshness auditable |
| Software/indexer/model version | Makes derived results reproducible |
| Evidence hash/signature | Detects modification after creation |

---

## 14. Security Architecture

| Layer | Controls |
|---|---|
| Identity | MFA, RBAC, least privilege, case-scoped access |
| Network | WAF, API gateway, rate limiting, segmentation |
| Application | Input validation, secure sessions, dependency scanning |
| Secrets | Secrets manager, key rotation, no secrets in source code |
| Data | Encryption in transit and at rest |
| Evidence | Append-only records, hashes, signatures, audit trail |
| Operations | Monitoring, alerting, incident response, access review |
| Backup | Protected/immutable copies and tested restoration |

---

## 15. Data Loss / Disaster Recovery

- Primary database + replica/HA database
- Point-in-time recovery for operational data
- Protected/immutable copies for evidence and raw data
- Separate backup location/failure domain where available
- Regular restoration drills
- Investigation checkpoints so long jobs resume after worker/node failure

---

## 16. 1,000-Investigator / High-Load Architecture

```
1,000+ investigators
        ↓
WAF + API Gateway + Load Balancer
        ↓
Authentication / RBAC
        ↓
Job Queue
        ↓
Trace Workers | ML Workers | Report Workers
        ↓
Shared Indexed Blockchain Data
        ↓
PostgreSQL + Graph DB + Redis + Object Storage
        ↓
Indexer
        ↓
Own Nodes + Independent RPC Providers
```

Repeated investigation of the same wallet should reuse indexed/cached results. Deep cases should have concurrency limits and fair scheduling so one large case cannot monopolize the cluster.

---

## 17. Data / Services Layout

| Component | Primary Role |
|---|---|
| PostgreSQL | cases, users, permissions, VASP registry, evidence metadata, audit records |
| Neo4j / Graph DB | wallet/transaction relationships and traversal |
| Redis | cache, job state, rate control |
| Queue | async deep tracing, ML and report jobs |
| Object storage | raw data, evidence packages, reports and model artifacts |
| Indexer | chain synchronization and normalized blockchain records |
| Node/RPC layer | canonical/independent blockchain access |
| ML service | feature generation, risk scoring and SHAP explanations |

---

## 18. Compute Planning

| Area | Initial Production-Planning Envelope |
|---|---|
| Blockchain nodes | Per chain: roughly 8–16+ CPU cores, 32–64 GB RAM and fast NVMe/SSD; redundant nodes. Exact storage depends on chain, client, retention and historical/archive requirements. |
| Indexer workers | Start with 4–8 instances, roughly 16–32 cores and 32–64 GB RAM each; scale from measured indexing lag. |
| Graph / analytics | Dedicated CPU/RAM sized from graph size and traversal concurrency; fast I/O is important. |
| Database | HA/replicated setup; planning envelope 16–32 cores and 64–128 GB RAM per node, then benchmark. |
| ML | CPU-first for XGBoost/LightGBM; 0–1 GPU initially; add GPUs only for later GNN/embedding workloads if justified. |
| Cache / queue | Small HA cluster initially; size from concurrency and cache hit rate. |

> These are planning envelopes, not measured requirements. Benchmark before procurement. In the initial platform, storage, indexing I/O, graph processing and network capacity can matter more than raw ML GPU compute.

---

## 19. Cost Planning

Planning ranges only; actual cost depends on cloud/on-prem, chain count, archive requirements, retention, redundancy, bandwidth, external data providers and security requirements.

| Level | Scope | Planning Range |
|---|---|---|
| SIH prototype | Existing UI/API + 1–2 chains + limited users + basic graph/ML/evidence | ~₹0.5–3 lakh incremental |
| Pilot | 2–3 chains + tens to ~100 investigators + backups/security | ~₹8–20 lakh initial + ₹1.5–5 lakh/month |
| Production | Multiple chains + ~1,000 investigators + HA/DR/security/monitoring | ~₹30 lakh–₹1 crore initial + ₹8–25 lakh/month |
| Large / national | Multiple agencies + large history + 24/7 + DR/SOC + many chains | ~₹1–3+ crore initial + ₹25–75+ lakh/month |

**Procurement rule:** benchmark first, then size. Do not purchase a full production cluster based only on theoretical 200,000-hop calculations.

---

## 20. Testing and Benchmark Matrix

| Area | Tests |
|---|---|
| Functional | wallet lookup, transfers, token events, contract/internal transfers, graph traversal, VASP lookup, evidence report |
| Data integrity | source disagreement, missing block, duplicate event, reorg, stale RPC, bad token contract |
| ML | precision, recall, F1, ROC-AUC, false positives, calibration, unseen patterns |
| Scale | 10 / 50 / 100 / 500 / 1,000 concurrent investigators; repeated same-wallet queries; fast/deep mix |
| Graph depth | 100 / 1,000 / 10,000 / 50,000 / 100,000 / 200,000 candidate nodes/hops |
| Failure | RPC outage, worker crash, DB failover, queue restart, storage failure, node restart |
| Recovery | resume checkpoint, restore backup, rebuild index, replay missing blocks |

---

## 21. Operational Monitoring

- Blockchain sync lag — detect stale nodes/indexers
- RPC latency/error rate — trigger failover
- Queue depth — detect demand spikes
- Worker health — retry failed jobs
- Database latency/storage — prevent capacity failures
- Cache hit rate — measure avoided duplicate work
- Evidence generation/verification failures — high-priority alert
- Security events — suspicious logins, exports, permission changes and abnormal job creation

---

## 22. Tricky Questions and Answers

**Q: What if the API is wrong?**
A: The API is not the sole proof. Critical data is cross-checked against an own node and independent sources.

**Q: What if the database is deleted?**
A: Use replicas, point-in-time recovery, protected/immutable backups and restoration drills.

**Q: What if the platform itself is hacked?**
A: Use MFA/RBAC, segmentation, WAF, encryption, secrets management, audit logs and protected evidence.

**Q: What if 1,000 investigators search simultaneously?**
A: Use shared indexing, cache, queues and horizontal workers instead of 1,000 direct blockchain scans.

**Q: What if 10,000 investigations arrive?**
A: Queue, quotas, priority scheduling and scalable workers; separate fast and deep jobs.

**Q: What if one investigation has 200,000 hops?**
A: Run as asynchronous deep forensics with bounded traversal, pruning, checkpointing and resume.

**Q: What if funds enter a mixer?**
A: Return the last verified hop, mark the boundary and reduce confidence; never invent an endpoint.

**Q: What if an exchange has one omnibus wallet?**
A: Attribute the managed service wallet, not the customer identity.

**Q: What if scammers create 100,000 wallets?**
A: Use graph/behavioral clustering to prioritize candidates; cluster membership is not proof of ownership.

**Q: What if someone creates fake USDT?**
A: Validate chain and token contract address, not token symbol.

**Q: What if funds cross chains?**
A: Use bridge/service registries and value/time/asset correlation; show uncertainty when unproven.

**Q: What if a transaction is reorganized?**
A: Track pending/confirmed/finalized state and revalidate before high-confidence evidence.

**Q: Do miners/validators need to be investigated?**
A: Not merely because they processed the transaction; only under a separate evidence-backed infrastructure/consensus hypothesis.

**Q: Can AI prove someone is a criminal?**
A: No. AI prioritizes risk/association; blockchain proves transactions; real-world identity needs appropriate external evidence.

**Q: Why not just use a commercial analytics provider?**
A: The platform can provide an India-specific investigator workflow with explicit provenance, controls and independently verifiable underlying data rather than treating one vendor score as the final answer.

---

## 23. Recommended Technology Stack

| Layer | Recommendation |
|---|---|
| Frontend | React / Next.js |
| Backend | Python + FastAPI |
| Primary chain | TRON / TRC-20 |
| Expansion | Ethereum / EVM, then additional chain adapters |
| Blockchain access | Own node(s) + independent RPC/indexer sources |
| Indexer | Python chain adapters + incremental synchronization |
| Operational DB | PostgreSQL |
| Graph | Neo4j or equivalent |
| Cache | Redis |
| Queue | RabbitMQ or Kafka |
| ML | XGBoost / LightGBM |
| Explainability | SHAP |
| Advanced graph ML | GNN / GraphSAGE / GAT — later |
| Evidence | SHA-256 + digital signatures + protected audit trail |
| Object storage | S3-compatible storage |
| Deployment | Docker; Kubernetes at production scale |
| Monitoring | Prometheus + Grafana |
| Security | MFA, RBAC, WAF, encryption, secrets management, audit logging |

---

## 24. Team Responsibility Model

| Role | Main Responsibility |
|---|---|
| Blockchain engineer | nodes/RPC, chain adapters, transaction/event parsing, reconciliation |
| Backend engineer | API, cases, queues, evidence service, authentication |
| Data/graph engineer | indexing, graph schema, traversal and performance |
| ML engineer | features, synthetic dataset, XGBoost/LightGBM, SHAP, evaluation |
| Frontend engineer | investigator workflow, graph visualization, evidence viewer |
| DevOps/Security | deployment, monitoring, secrets, backups, DR and hardening |
| Investigation/domain lead | VASP labels, rules, case workflow, evidence standards and human review |

---

## 25. Definition of Done — SIH Prototype

- [ ] A suspect TRON wallet can be ingested and normalized
- [ ] Transactions/token transfers can be independently verified
- [ ] A wallet-to-wallet graph is visible
- [ ] Multi-hop tracing handles split/merge and bounded traversal
- [ ] A VASP/service attribution can be shown with provenance and confidence
- [ ] The ML model returns a risk score with SHAP explanation
- [ ] On-chain facts are clearly separated from attribution and identity
- [ ] Evidence packages can be hash/signature checked
- [ ] A deep investigation can run asynchronously and resume after interruption
- [ ] Basic RBAC/audit logging and backup/restore are tested
- [ ] Load tests provide measured results for concurrent users and deep jobs

---

## 26. Final Implementation Sequence

```
Existing UI + basic API calls
        ↓
Normalized chain data model
        ↓
TRON node/RPC + independent verification
        ↓
Indexer + historical records
        ↓
Graph database + bounded multi-hop tracing
        ↓
VASP/entity registry + attribution
        ↓
20–25 feature ML model + SHAP
        ↓
Evidence hash/sign/audit
        ↓
Cross-chain support
        ↓
Queue + cache + checkpointing
        ↓
Security + backup + monitoring
        ↓
10K / 50K / 100K / 200K graph benchmarks
        ↓
1,000-user concurrency benchmarks
        ↓
Production hardening
```

> **Most important implementation rule:** build the chain of trust first — verified blockchain data → graph → VASP attribution → explainable ML → evidence. Only after that is stable should advanced GNNs, broad multi-chain coverage and large production scale be added.

