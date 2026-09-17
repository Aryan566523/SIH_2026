# 🛡️ ChainSentinel AI

**Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges from Victim-Reported Suspect Wallet Addresses through Automated Blockchain Analytics**

> Smart India Hackathon 2024 — Problem Statement PS-26183 | Ministry of Home Affairs (I4C Division)

---

## 📌 What Is This?

ChainSentinel AI is an AI-powered blockchain forensics platform built for **Indian Law Enforcement Agencies (LEAs)**. When a victim of cryptocurrency fraud walks into a police station and provides a suspect wallet address, this platform:

1. Automatically traces how the money flowed across the blockchain
2. Identifies what exchange (VASP) the money ultimately reached
3. Generates evidence-backed police reports and freeze-request drafts

---

## 🏗️ Architecture

```
chainsentinel-ai/
├── apps/
│   ├── web/           # Next.js 14 frontend (App Router, Tailwind, React Flow)
│   ├── api/           # NestJS backend (REST + WebSocket + Swagger)
│   └── worker/        # BullMQ background investigation worker
├── packages/
│   ├── types/         # Shared TypeScript types
│   ├── config/        # Shared configuration
│   └── logger/        # Structured logging
├── infrastructure/
│   └── docker/        # Docker configs
├── ml/                # Python XGBoost model training pipeline
├── docker-compose.yml
└── .env.example
```

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion, React Flow, Recharts, Zustand |
| **Backend** | NestJS 10, TypeORM, Passport JWT, class-validator, Swagger/OpenAPI |
| **AI / ML** | XGBoost (trained in Python, runs in Node.js via JSON model artifacts), SHAP explainability, rule-based heuristic fallback |
| **Database** | PostgreSQL 16 (primary), Neo4j 5 (graph queries), Redis 7 (cache + queue) |
| **Queue** | BullMQ + Redis (concurrent investigation isolation) |
| **Realtime** | Socket.IO WebSocket (live pipeline progress to browser) |
| **Blockchain** | Multi-provider abstraction: Etherscan, TronGrid, Blockscout, Alchemy, Infura |
| **Auth** | JWT access + refresh tokens, bcrypt, RBAC (Admin/Supervisor/Investigator) |
| **DevOps** | Docker, docker-compose, pnpm workspaces |

---

## 🚀 Quick Start (Development)

### Prerequisites

- **Node.js** >= 18.0
- **pnpm** >= 8.0 (`npm install -g pnpm`)
- **Docker** & **Docker Compose** (for PostgreSQL, Neo4j, Redis)

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd chainsentinel-ai

# 2. Copy environment file and fill in your API keys
cp .env.example .env
# Edit .env — add ETHERSCAN_API_KEY, TRONGRID_API_KEY etc.

# 3. Start all databases via Docker
docker compose up -d postgres neo4j redis

# 4. Install all dependencies
pnpm install

# 5. Run database migrations
pnpm --filter @chainsentinel/api db:migrate

# 6. Seed default users and sample data
pnpm --filter @chainsentinel/api db:seed

# 7. Start all development servers in parallel
pnpm dev
```

This starts:
| Service | URL |
|---------|-----|
| Frontend (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001 |
| Swagger API Docs | http://localhost:3001/docs |
| Neo4j Browser | http://localhost:7474 |
| Redis | localhost:6379 |
| PostgreSQL | localhost:5432 |

---

## 🌐 Production / Server Deployment

### Prerequisites on Server

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Docker
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable docker && sudo systemctl start docker
```

### Full Docker Production Deploy

```bash
# 1. Clone and configure
git clone <repo-url> /opt/chainsentinel
cd /opt/chainsentinel
cp .env.example .env
nano .env   # Set all production secrets and API keys

# 2. Build all services
docker compose -f docker-compose.yml build

# 3. Start all services (database + app)
docker compose -f docker-compose.yml up -d

# 4. Run migrations inside the running API container
docker compose exec api pnpm db:migrate
docker compose exec api pnpm db:seed

# 5. Verify all containers are healthy
docker compose ps
```

### Environment Variables (Production)

```env
# Database
DATABASE_URL=postgresql://chainsentinel:PASSWORD@postgres:5432/chainsentinel
REDIS_URL=redis://redis:6379

# Neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_secure_password

# JWT (generate with: openssl rand -hex 64)
JWT_SECRET=your_256_bit_random_secret_here
JWT_REFRESH_SECRET=another_256_bit_random_secret_here

# Blockchain API Keys
ETHERSCAN_API_KEY=your_etherscan_key
TRONGRID_API_KEY=your_trongrid_key
ALCHEMY_API_KEY=your_alchemy_key
INFURA_PROJECT_ID=your_infura_id

# Application
NEXT_PUBLIC_API_URL=https://your-domain.com
API_PORT=3001
NODE_ENV=production
```

### Build Only (Without Docker)

```bash
# Build all packages
pnpm build

# Start API in production mode
cd apps/api && node dist/main.js

# Start web in production mode
cd apps/web && pnpm start
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔑 Default Users

After seeding, these users are created. **Change all passwords immediately in production.**

| Role | Email | Default Password |
|------|-------|-----------------|
| Super Admin | admin@chainsentinel.gov.in | Admin@1234 |
| Supervisor | supervisor@chainsentinel.gov.in | Super@1234 |
| Investigator | investigator@chainsentinel.gov.in | Invest@1234 |

Create admin manually:
```bash
pnpm --filter @chainsentinel/api db:admin
```

---

## 📋 Core Features

### 1. Automated Investigation Pipeline
| Stage | Description |
|-------|-------------|
| Address Validation | Validates format against ETH/TRON/BTC patterns |
| Chain Detection | Auto-detects blockchain from address format |
| Transaction Ingestion | Database-first cache, then live blockchain API |
| Graph Build | Constructs transaction relationship graph in Neo4j |
| Fund-Flow Tracing | BFS/DFS with VASP auto-stop boundary detection |
| Entity Matching | Labels wallets as VASP, Mixer, Bridge, Miner etc. |
| Cross-Chain Analysis | Detects bridge interactions and chain hops |
| Risk Scoring | XGBoost ML + SHAP explanation (falls back to rules) |
| VASP Attribution | Identifies destination exchange for freeze request |
| Pattern Detection | Fan-Out, Peel Chain, Rapid Forwarding, Smurfing |
| Evidence Generation | SHA-256 integrity hash for chain of custody |
| Report Generation | PDF court-admissible report with Section 91 notice draft |

### 2. Smart Victim Wallet Resolver
If the complainant only knows their **own** wallet (not the scammer's), the platform:
1. Scans outgoing transactions from the victim's wallet
2. Identifies funds sent to unknown addresses
3. Auto-selects the most likely fraud destination as the investigation target

### 3. Multi-User Concurrent Safety
- `orIgnore()` INSERT strategy prevents duplicate key conflicts when multiple investigators scan the same wallet simultaneously
- BullMQ isolates each investigation as an independent job
- Database-first caching avoids redundant API calls across users

### 4. Real-Time Progress
- WebSocket pushes live stage updates to the browser
- No page refresh needed during pipeline execution

---

## 🤖 AI / ML Model Details

| Component | Details |
|-----------|---------|
| **Model Type** | XGBoost (Extreme Gradient Boosting) |
| **Training** | Python (`ml/train.py`), 25 wallet-level features |
| **Runtime** | Node.js — reads exported `model.json` + `manifest.json` |
| **Explainability** | SHAP (SHapley Additive exPlanations) per prediction |
| **Fallback** | Rule-based heuristic engine if model artifacts missing |
| **Integrity** | SHA-256 hash of model artifacts verified at startup |
| **Drift Detection** | Prediction distribution compared to training baseline |

Features include: transaction frequency, avg amount, mixer interaction count, bridge usage, rapid forwarding ratio, hop distance from reported address, inflow/outflow ratio, VASP proximity score, and more.

---

## 🔐 Concurrent User Handling

The system is designed for **multiple simultaneous investigators**:

1. **`ON CONFLICT DO NOTHING`** — All transaction INSERTs use TypeORM `.orIgnore()` which translates to PostgreSQL's `INSERT ... ON CONFLICT DO NOTHING`. If two investigators scan the same wallet at the same time, only the first write succeeds; the second is discarded silently.

2. **Database-First Cache** — Before calling any external API, the system checks if transactions already exist in the local PostgreSQL index. If they do, they're served immediately without any API call. This eliminates race conditions on rate-limited APIs.

3. **BullMQ Job Isolation** — Each investigation runs as an independent background job in the queue. Jobs don't share state, so one investigation failing does not affect another.

4. **TRON Address Normalization** — TRON addresses exist in two formats (Base58: `TXxx...` and Hex: `41xx...`). The system normalizes both to Base58 before storing, preventing duplicate records for the same wallet.

---

## 📊 Compute Requirements

| Scan Depth | Time | RAM | Notes |
|------------|------|-----|-------|
| 3 hops (fast) | ~50ms | ~10MB | Good for quick initial scans |
| 5 hops (standard) | ~300ms | ~50MB | Default for most cases |
| 10 hops (deep) | ~2-5s | ~200MB | Serious fraud syndicate analysis |
| 25 hops (extended) | ~30s | ~1GB | Complex money-mule networks |
| 50 hops (max) | ~2-5min | ~4GB | Full syndicate mapping |

**Hops Growth Formula:** If a wallet has `N` average transactions, depth `D` hops inspects up to `N^D` paths. Smart pruning, minimum amount filters, and VASP auto-stop keep this tractable in practice.

---

## 📁 Project Scripts

```bash
pnpm dev              # Start all services in parallel (watch mode)
pnpm build            # Build all packages for production
pnpm test             # Run all tests
pnpm lint             # Lint all packages

# API specific
pnpm --filter @chainsentinel/api db:migrate   # Run DB migrations
pnpm --filter @chainsentinel/api db:seed      # Seed default data
pnpm --filter @chainsentinel/api db:admin     # Create admin user interactively

# Build individual apps
pnpm --filter @chainsentinel/api build
pnpm --filter @chainsentinel/web build
```

---

## 🧪 Running Tests

```bash
# All tests
pnpm test

# API unit tests only
pnpm --filter @chainsentinel/api test:unit

# Web component tests
pnpm --filter @chainsentinel/web test
```

---

## 📜 License

Built for SIH 2024, Problem Statement PS-26183, Ministry of Home Affairs — Indian Cyber Crime Coordination Centre (I4C).
