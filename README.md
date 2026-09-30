# ChainSentinel

**AI-Powered Cryptocurrency Fraud Investigation & Tracing Platform**

ChainSentinel is an advanced, multi-layered investigative platform designed to trace, analyze, and detect cryptocurrency fraud and money laundering. It enables Law Enforcement Agencies (LEAs) and compliance teams to rapidly map complex fund flows, identify high-risk wallets, and generate court-defensible intelligence.

## 🚀 Features

- **Automated Investigation Pipeline**: Scans wallets, normalizes cross-chain transactions, and maps multi-hop fund flows automatically.
- **AI-Powered Risk Scoring**: Uses a custom-trained XGBoost machine learning model to classify wallets and explain decisions using TreeSHAP.
- **Rule-Based Heuristic Engine**: Detects specific money laundering typologies (e.g., Peel Chains, Fan-Out, Rapid Forwarding).
- **Interactive Transaction Graph**: Visualizes complex fund paths with real-time risk indicators and VASP (Virtual Asset Service Provider) endpoints.
- **Live Evidence Management**: Securely logs investigation trails, tracks case statuses, and aids in Section 91 CrPC notice generation for VASPs.

## 🏗 Architecture & Dependencies

ChainSentinel utilizes a modern, robust multi-tier architecture to handle large-scale graph traversals and relational data simultaneously.

### Tech Stack
- **Frontend**: React, Next.js, Tailwind CSS, React Flow (for Graph Visualization).
- **Backend API**: Node.js, NestJS (REST & GraphQL).
- **Graph / Trace Database**: Neo4j (for complex multi-hop pathfinding).
- **Relational Database**: PostgreSQL (via TypeORM for Cases, Evidence, Investigations).
- **Caching & Queue**: Redis + BullMQ (for isolated, asynchronous investigation pipelines).
- **Blockchain Integration**: Dynamic API expansion via Etherscan & Blockscout APIs.

## 🧠 AI / ML Model

### What Model is Used?
ChainSentinel uses a custom **XGBoost (Extreme Gradient Boosting) Tree Ensemble** model (`xgb-wallet-v1`).
- **Features Evaluated**: 25 specific wallet-level features (velocity, average amount, fan-out, mixer exposure, hop depth, etc.).
- **Explainability**: Outputs deterministic **TreeSHAP** (SHapley Additive exPlanations) values so investigators can see exactly *why* a wallet was flagged (e.g., "+35 risk due to Tornado Cash interaction"). The Node.js backend computes this directly without requiring a Python runtime in production.

### Dataset
- **Training Data**: Trained on **4,000 synthetic cases** representing complex, multi-layered fraud scenarios.
- **Validation**: Benchmarked against real-world datasets, including the **Elliptic Data Set** for anti-money laundering.

### Model Location
- **Training Scripts & Notebooks**: Located in the `ml/` directory.
- **Deployed Artifact**: The compiled model is located at `ml/artifacts/model.json`, which is natively ingested by the NestJS API.

## 🕵️ Detection Conditions & Rules

ChainSentinel uses a hybrid approach, combining the ML model with a **Heuristic Fallback Engine** that actively monitors for specific conditions:

1. **Address Format Validation**: Ensures the suspect wallet matches known blockchain formats (Ethereum `0x`, TRON `T`, Bitcoin).
2. **Minimum Amount Filter**: Prunes dust/gas transactions below a fiat threshold to drastically reduce graph noise.
3. **Mixer Feeders**: Actively flags wallets sending funds directly to known mixer contracts (e.g., Tornado Cash).
4. **Fan-Out Condition**: Triggers when a single wallet sends funds to 3+ unique destinations within 24 hours (Money Mule indicator).
5. **Peel Chain Condition**: Triggers on long linear chains (5+ hops) where wallets pass nearly all their balance forward (Layering).
6. **Rapid Forwarding Condition**: Flags funds forwarded to a new wallet in under 1 hour.
7. **Cross-Chain Bridge Detection**: Flags interactions with ThorChain, Stargate, etc., indicating chain-hopping.
8. **VASP Auto-Stop**: Automatically halts tracing upon hitting a known regulated VASP (e.g., Binance), as this is the optimal point for a legal freeze request.

## 🌐 Hops & Graph Expansion
**Hops: Computational Growth Formula**
Graph tracing grows exponentially. If a wallet has $N$ outgoing transactions on average, at depth $D$, the system inspects $N^D$ wallets. ChainSentinel mitigates this using smart pruning (Min Amount Filters) and Auto-Stop on VASPs to ensure tractable compute times while digging deep (e.g., 5-10 hops).

## 📂 Project Structure

```text
ChainSentinel/
├── apps/
│   ├── web/                # Next.js Frontend Dashboard (React Flow, Tailwind)
│   └── api/                # NestJS Backend API (Graph Logic, Rules, ML Parser)
├── packages/
│   └── types/              # Shared TypeScript definitions (DTOs, Enums)
├── ml/                     # ML training notebooks, dataset processing, Elliptic benchmark
│   └── artifacts/
│       └── model.json      # XGBoost exported tree ensemble
└── README.md               # You are here!
```

## 🔌 API Ecosystem
- **Graph Controller**: Handles live tracing, Etherscan API normalization, and Neo4j node generation.
- **Risk Service**: Executes the rules engine, applies thresholds, and runs the XGBoost model.
- **Search Service**: Global polymorphic search across Wallets, Cases, Alerts, Investigations, and Reports.
- **Classification Service**: Parses ABIs and tags contract types (DEX, Mixer, Bridge).

## ⚙️ How to Set It Up

### Prerequisites
- Node.js (v18+)
- pnpm (recommended)
- Docker & Docker Compose (for Neo4j, PostgreSQL, and Redis)

### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-org/chainsentinel.git
   cd chainsentinel
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Start Infrastructure (Databases)**:
   Ensure you have Docker running, then spin up Postgres, Neo4j, and Redis:
   ```bash
   docker-compose up -d
   ```

4. **Environment Variables**:
   Copy `.env.example` to `.env` in both `apps/api` and `apps/web`, and provide the required API keys (Etherscan, Blockscout, Database URLs).

5. **Run the Application**:
   ```bash
   # Starts both frontend and backend in development mode
   pnpm dev
   ```

6. **Access the Platform**:
   Open `http://localhost:3000` to access the ChainSentinel Dashboard. The API runs on `http://localhost:3001`.
