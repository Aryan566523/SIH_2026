# TECHNICAL RESEARCH & REFERENCES

## CRYPTOCURRENCY AML / BLOCKCHAIN FORENSICS RESEARCH

### 1. Graph Neural Networks for Cryptocurrency AML
- **Source:** "A Survey on Graph Neural Network Approaches for Fraud Detection in Blockchain Networks" — *IJFMR*, Vol. 3, Issue 3, May-June 2026.
- **Relevance:** Provides the mathematical foundation for structuring multi-hop transactions as a directed property graph in Neo4j and training Graph Neural Networks (GNNs) — specifically GCN, GAT, GraphSAGE, and temporal GNN variants — to classify illicit intermediary wallets with F1-scores exceeding 0.82 on the Elliptic benchmark.

### 2. Subgraph Contrastive Learning for Laundering Groups
- **Source:** Chen et al., "Bitcoin Money Laundering Detection via Subgraph Contrastive Learning," *Sensors*, vol. 24, no. 6, Mar. 2024.
- **Relevance:** Directly guides the Dynamic Heuristic Pruning Algorithm by treating laundering detection as a subgraph-level representation task. Positive/negative sampling via ego-subgraph augmentation isolates peeling chains and tracks primary fund flow to the exchange, eliminating transaction dust (<5%).

### 3. Feature-Gated Temporal Graph Learning (FG-EGCN)
- **Source:** "Illicit Cryptocurrency Transaction Detection: A Feature-Gated Temporal Graph Model," *Scientific Reports* (Nature), 2026.
- **Relevance:** Proposes FG-EGCN, which combines temporal graph encoding with a residual feature branch and adaptive gating mechanism. Achieves illicit F1-score of 0.774 and MicroAVG F1 of 0.971 on the Elliptic Bitcoin dataset, improving robustness under temporal distribution shift.

### 4. Heterogeneous Graph Contrastive Learning (HeteroGCL)
- **Source:** "HeteroGCL: A Heterogeneous Graph Contrastive Learning Framework for Scalable and Sustainable Cryptocurrency AML," *Applied Sciences* (MDPI), vol. 16(6), 2026.
- **Relevance:** Integrates heterogeneous graph attention networks (HGAT) with topology-aware and attribute-aware graph augmentations. Achieves F1-score of 0.824 and AUC of 0.912 on the Elliptic dataset, with 4.7% improvement over CARE-GNN baseline, enabling label-efficient AML under severe class imbalance.

### 5. Transaction Semantics Parsing & Fund Flow Tracking (FlowShield)
- **Source:** "FlowShield: Cryptocurrency AML with Transaction Semantics Parsing and Fund Flow Tracking," *arXiv:2608.17355* (Accepted at IEEE ICDM 2026).
- **Relevance:** Recovers behavior-level semantics (direct transfers, token swaps, indirect transfers, cross-chain transfers) and reconstructs fund-flow subgraphs from upstream, downstream, and parallel perspectives. Fuses LLM-encoded semantics with GCN-encoded structure to generate investigator-facing Suspicious Activity Reports (SARs) with average F1 of 98.0%.

### 6. Wavelet-Temporal Graph Transformer (ChronoWave-GNN)
- **Source:** "Detecting Illicit Transactions in Bitcoin: A Wavelet-Temporal Graph Transformer Approach for AML," *Scientific Reports*, 2026.
- **Relevance:** Combines discrete wavelet transforms (DWT) with temporal embeddings to capture nonstationary, multiscale laundering patterns. Achieves test accuracy of 0.9802 and F1-score of 0.9799 on the Elliptic dataset, surpassing prior state-of-the-art by modeling both high-frequency bursts and low-frequency structural trends.

### 7. Dynamic Graph Neural Networks with Semi-Supervised Co-Association (CoSemiGNN)
- **Source:** "CoSemiGNN: Blockchain Fraud Detection with Dynamic Graph Neural Networks Based on Co-Association of Semi-Supervised," *Expert Systems with Applications* (Elsevier), 2026.
- **Relevance:** Captures novel illicit transaction patterns from unlabeled data via co-occurrence edge relationships and co-occurrence feature aggregation. Outperforms existing methods by up to 30% in F1 scores under distributional migration, combining semi-supervised learning with self-attention RNNs for temporal dynamics.

### 8. Foundational Heuristic Clustering for Entity Attribution
- **Source:** Weber et al., "Anti-Money Laundering in Bitcoin: Experimenting with Graph Convolutional Networks for Financial Forensics," *Elliptic* / MIT-IBM Watson AI Lab.
- **Relevance:** Establishes core wallet-clustering heuristics (common-input ownership, change address detection, peel-chain identification) used to map anonymous leaf addresses to known Virtual Asset Service Provider (VASP) hot/cold wallets.

---

## CASE STUDIES

### 1. Hyderabad Crypto Fraud Case (February 2026)
- **Incident:** Scammers created a fake website pretending to conduct KYC identity verification and tricked a victim into connecting his crypto wallet. As soon as the wallet was connected, a hidden trap instantly stole ₹19 Crore (~$2.2M) in USDT without the victim's permission.
- **Source:** Times of India / Cyber Crime Reporting Portal, February 2026.

### 2. Tether Freezes $344M USDT on TRON (April 2026)
- **Incident:** U.S. law enforcement (OFAC coordination) identified two Tron blockchain addresses linked to Iran's Bank Markazi (Central Bank of Iran) and IRGC-Qods Force sanctions evasion. Tether froze $344M across addresses `TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81` (~$213M) and `TTiDLWE6fZK8okMJv6ijg42yrH6W2pjSr9` (~$131M).
- **Source:** Tether Official Announcement, CoinDesk, Decrypt — April 23, 2026.

### 3. ED Seizes ₹3.35 Cr Crypto in Multi-State Raids (July 2026)
- **Incident:** India's Enforcement Directorate conducted searches at 16 locations in Tamil Nadu, 2 in Kerala, and 1 in Srinagar under PMLA. Seized ₹3.35 crore in cryptocurrency, ₹14.5 lakh in cash, and recovered seed phrases / wallet details / exchange account info from accused linked to fake investment and work-from-home scams.
- **Source:** ED Press Release, The New Indian Express, July 16, 2026.

### 4. ₹303 Crore Dubai-Linked Cyber Fraud Ring (July 2026)
- **Incident:** ED dismantled a ₹303 crore ($35M) crypto fraud ring with a trail leading to Dubai. Froze 1.6 lakh+ Tether (USDT) and 563 Ethereum. Funds routed through PYYPL (UAE fintech), Binance, GetBit, and Carretx.
- **Source:** KryptoNews / ED disclosures, July 2026.

### 5. Bengaluru KOL Crypto Scam — ₹300+ Crore (July 2026)
- **Incident:** Self-styled crypto influencers (KOLs) duped foreign investors via OTC deals promising discounted MultiverseX, Kava, BEAM, GRASS, SUI, VANA, AGLD tokens. Scaled to ~$35M (₹300+ crore). ED seized 8,700 USDT and digital devices.
- **Source:** ED Press Release 21/07/2026, Times of India, July 2026.

### 6. Binance-Assisted Terror Financing Bust — ₹226.54 Crore (August 2026)
- **Incident:** Indian authorities, with Binance assistance, dismantled a ₹226.54 crore terror-financing crypto network. 14 arrests. Combined traced volume: $23.96M across accused accounts, with 30-40% estimated as "dirty crypto" linked to terror, cyber fraud, and organized crime.
- **Source:** The Crypto Times, August 4, 2026.

### 7. ISIS-K Linked TRON Wallets Frozen (July 2026)
- **Incident:** OFAC added 134 crypto wallet identifiers (131 TRON + 3 Monero) linked to ISIS-K. Tether froze USDT balances in all 131 TRON wallets. Chainalysis noted the wallets received >$1.4M and sent >$880K since 2023.
- **Source:** Chainalysis, OFAC Recent Actions, July 1-2, 2026.

### 8. Iran Crypto Sanctions — Operation Economic Fury (2026)
- **Incident:** U.S. Treasury/OFAC sanctioned Iran's Central Bank (Bank Markazi) and IRGC-linked wallets on TRON. Cumulative frozen value: ~$475M (April $344M + July $131M). Tether executed freezes within hours of OFAC designation.
- **Source:** U.S. Treasury, Decrypt, CryptoSlate — April-July 2026.

### 9. BitConnect Ponzi Seizure — ₹1,646 Crore (February 2025)
- **Incident:** ED Ahmedabad seized cryptocurrency worth ₹1,646 crore (~$190M) from devices linked to BitConnect founder Satish Kumbhani. Largest single-day crypto seizure by any Indian agency. Funds tracked across Bitcoin, Ethereum, and USDT conversions.
- **Source:** KryptoNews, The Hindu BusinessLine, 2025-2026.

### 10. Gain Bitcoin Scam — ₹20,000 Crore (March 2026)
- **Incident:** CBI arrested Darwin Labs co-founder Ayush Varshney for designing the MCAP token, GBMiners.com, and Coin Bank Bitcoin wallet infrastructure used in the Gain Bitcoin Ponzi scheme. Launched in 2015 under Variabletech Pte. Ltd., promised 10% monthly BTC returns.
- **Source:** The Hindu BusinessLine, CBI Statement, March 11, 2026.

### 11. FQL App Crypto Scam — ₹150 Crore (August 2026)
- **Incident:** Fake investment mobile app "FQL" duped ~8,000 investors in Tamil Nadu's Dindigul/Melur region. Multi-level marketing scheme promised doubled deposits in crypto. Police seized ₹3.35 crore in crypto and traced wallet addresses.
- **Source:** CryptoTimes, Times of India, August 28-29, 2026.

---

## DATASETS & TOOLS

| Resource | Description | Link |
|----------|-------------|------|
| **Elliptic Dataset** | 203,769 Bitcoin transactions, 234,355 edges, 49 time steps, labeled illicit/licit/unknown | https://www.kaggle.com/datasets/ellipticco/elliptic-data-set |
| **Elliptic++ Dataset** | Extended dataset with 822,942 wallet addresses, 1,268,260 temporal interactions | https://github.com/git-disl/EllipticPlusPlus |
| **BybitML Dataset** | First public multi-chain laundering dataset (FlowShield) | https://github.com/FlowShield-AML/BybitML |
| **BlockSec Freeze Checker** | Real-time USDT blacklist checker for Ethereum & TRON | https://blocksec.ai/en/usdt-freeze |
| **USDT Ban List** | Live TRON USDT blacklist event feed | https://usdtbanlist.com/latest-tron-blacklist-events |
| **Chainalysis Reactor** | Blockchain investigation & wallet attribution tool | https://www.chainalysis.com/ |
| **Arkham Intelligence** | On-chain wallet labeling & government seizure tracking | https://arkhamintelligence.com/ |
