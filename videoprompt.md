# 🎬 Video Script — ChainSentinel AI
### SIH 2024 | PS-26183 | Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges from Victim-Reported Suspect Wallet Addresses through Automated Blockchain Analytics

---

## SEGMENT 1 — INTRO (0:00–0:15)

> *[Open on the ChainSentinel login screen. Slow dramatic zoom-in.]*

**VOICEOVER:**

"Every day in India, thousands of citizens lose their hard-earned money to cryptocurrency fraud. The victims come to the police — but investigations stall because tracing crypto is complex, manual, and slow. We built ChainSentinel AI to change that."

---

## SEGMENT 2 — IDEA TITLE & CONCEPT (0:15–0:55)

> *[Cut to a clean title card: "ChainSentinel AI — Automated Crypto Fraud Investigation Platform"]*

**VOICEOVER:**

"Our idea is simple: When a victim walks into a police station and reports a cryptocurrency fraud — the moment an investigator enters the suspect wallet address into our platform — ChainSentinel AI takes over completely.

It traces every rupee through the blockchain, hop by hop, identifying where the money went, which exchange it reached, and automatically generates a court-ready evidence report with a draft freeze request — all in seconds, not weeks."

> *[Show a clean architecture diagram — simple 4-block flow: Victim → Police → ChainSentinel AI → Exchange Freeze]*

**VOICEOVER:**

"The architecture is straightforward. The police investigator enters the suspect address. Our backend pipeline validates it, fetches the transaction history from the blockchain, builds a visual money-flow graph, runs AI-powered risk scoring, identifies the destination exchange — called a VASP — and generates the evidence report.

All of this happens automatically. No manual blockchain analysis. No technical knowledge required."

---

## SEGMENT 3 — TECHNICAL APPROACH (0:55–2:00)

> *[Cut to a system diagram showing: Frontend → NestJS API → BullMQ Queue → Pipeline Worker → PostgreSQL + Neo4j + Redis]*

**VOICEOVER:**

"Technically, ChainSentinel is built as a full-stack monorepo. The frontend uses Next.js 14 with real-time WebSocket updates — so the investigator sees live progress as each pipeline stage completes.

The backend is a NestJS API that receives the investigation request and queues it as a job in BullMQ — our task queue built on Redis. This means multiple investigators can run investigations at the same time without interfering with each other.

The pipeline has 12 stages: Address validation, chain detection, transaction ingestion, graph generation, fund-flow tracing, entity matching, cross-chain analysis, risk scoring, VASP attribution, pattern detection, evidence generation, and finally — report generation."

> *[Show the pipeline stage list]*

**VOICEOVER:**

"Our AI risk scoring uses XGBoost — a trained machine learning model — which analyzes 25 features of each wallet: how often it transacts, how quickly it forwards funds, whether it has interacted with known mixers or sanctioned addresses.

For each prediction, we use SHAP — Explainable AI — which tells the investigator exactly which factors drove the risk score. This makes the AI's decision transparent and defensible in court.

For multiple concurrent users, we use an ON CONFLICT DO NOTHING database strategy — meaning if two investigators scan the same wallet at the same time, the data is written exactly once, with zero errors."

> *[Show the graph visualization and hop formula]*

**VOICEOVER:**

"The transaction graph traces money hop by hop. Each hop multiplies the search space — 5 transactions per wallet at 5 hops means up to 3,000 wallets inspected. Our smart VASP auto-stop terminates the trace the moment it reaches a regulated exchange — which is the optimal legal boundary for a Section 91 notice."

---

## SEGMENT 4 — DEMO VOICEOVER (2:00 onward — screen-by-screen)

> *Use these voiceover lines for whichever screens you show in the demo. They are written to work for any order.*

---

### 📍 When showing the LOGIN screen:

**VOICEOVER:**

"The platform uses role-based access control with JWT authentication. Investigators, supervisors, and administrators each see only what they need. Here we log in as an investigator."

---

### 📍 When showing the DASHBOARD (Command Center):

**VOICEOVER:**

"The command center gives an instant overview of all active investigations, critical alerts, suspect wallets currently being monitored, and VASP matches. Every number here is live — pulled from the database in real time."

---

### 📍 When showing the NEW INVESTIGATION page:

**VOICEOVER:**

"Creating a new investigation is a guided 4-step process. The investigator enters the case title, selects the fraud type, and specifies the suspect wallet address. 

Notice this Smart Resolver panel — if the complainant only knows their own wallet and not the scammer's, the investigator pastes the victim's wallet here. The system automatically scans outgoing transactions and identifies where the money was sent — automatically filling in the suspect address. No manual blockchain lookup required."

---

### 📍 When showing the INVESTIGATION DETAIL page (live progress):

**VOICEOVER:**

"Once launched, the pipeline runs in the background and streams live progress directly to the browser via WebSocket. Watch as each stage completes — transaction ingestion, graph build, risk scoring, VASP attribution. The investigator doesn't need to refresh or wait — everything updates in real time."

---

### 📍 When showing the TRANSACTION GRAPH:

**VOICEOVER:**

"The transaction graph visualizes exactly how money flowed — wallet to wallet, hop by hop. Each node is color-coded: red for suspect, orange for mixer, cyan for bridge, purple for exchange. 

The money transferred amount is shown directly inside each wallet card and as a pill on each connection. Investigators can click any connection to see the exact transfer amount, sender, recipient, and transaction hash.

The radar navigator in the bottom right lets investigators jump across large multi-hop graphs — click any node in the preview to jump directly to it. Quick action buttons let you snap to the suspect wallet or the latest hop instantly."

---

### 📍 When showing the INVESTIGATION REPORT:

**VOICEOVER:**

"When the pipeline completes, ChainSentinel generates a court-admissible investigation report. It includes the full fund flow analysis, VASP attribution with exchange name and jurisdiction, risk score with AI explanation, detected fraud patterns, and a draft Section 91 notice ready to be served to the identified exchange."

---

### 📍 When showing the ALERTS page:

**VOICEOVER:**

"The alert center shows all system-generated warnings — wallet activity triggers, high-risk pattern detections, and watchlist matches. Critical alerts are highlighted in red. Investigators can click any alert to see full details and navigate directly to the related investigation."

---

### 📍 When showing the WATCHLIST:

**VOICEOVER:**

"The watchlist continuously monitors suspect wallets in the background. The moment a monitored wallet makes a new transaction or reaches a VASP, the system automatically generates an alert. This is especially useful for repeat-offender fraud syndicates."

---

### 📍 When showing the VASP DIRECTORY:

**VOICEOVER:**

"The VASP directory contains known cryptocurrency exchanges — both regulated and illicit. When a suspect wallet's money trail leads to one of these exchanges, ChainSentinel identifies it automatically and includes the exchange's jurisdiction, legal contact, and regulatory status in the investigation report."

---

### 📍 When showing the GLOSSARY page:

**VOICEOVER:**

"The built-in glossary explains every technical term used in the platform — from hops and VASP to XGBoost and SHAP — making the platform accessible to investigators with no blockchain background."

---

### 📍 When showing CROSS-CHAIN MONITOR:

**VOICEOVER:**

"The cross-chain monitor tracks when suspects move funds between different blockchains — for example, from Ethereum to TRON using a bridge protocol. This is a common obfuscation technique, and our system automatically detects and flags it in the investigation."

---

### 📍 CLOSING (final screen):

**VOICEOVER:**

"ChainSentinel AI transforms cryptocurrency fraud investigation from a weeks-long manual process into a fully automated, seconds-fast, AI-powered pipeline — giving Indian law enforcement the tools they need to freeze stolen funds before the trail goes cold.

Built for Smart India Hackathon 2024 under Problem Statement PS-26183, issued by the Ministry of Home Affairs, Indian Cyber Crime Coordination Centre."

---

## 📝 Production Notes

- All voiceover segments are designed to work **independently** — use whichever screens appear in your demo
- For screen transitions, a 1–2 second pause after each section works well
- The demo flow we recommend: Login → Dashboard → New Investigation → Live Progress → Transaction Graph → Investigation Report → Alerts → Closing
- Total estimated runtime: **3–4 minutes** for a complete walkthrough
