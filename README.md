# 🛡️ ChainSentinel AI

**Real-Time Multi-Chain Crypto Fraud Attribution & Investigation Intelligence Platform**

A production-grade, AI-assisted blockchain intelligence platform for law enforcement agencies, cybercrime investigators, and blockchain analysts. Converts victim-reported cryptocurrency wallet addresses into automated investigations with VASP attribution and evidence-backed risk scoring.

## 🏗️ Architecture

```
chainsentinel-ai/
├── apps/
│   ├── web/           # Next.js 14 frontend (App Router, Tailwind, shadcn-inspired)
│   ├── api/           # NestJS backend (REST + WebSocket + Swagger)
│   └── worker/        # BullMQ investigation worker
├── packages/
│   ├── types/         # Shared TypeScript types
│   ├── config/        # Shared configuration
│   └── logger/        # Structured logging
├── infrastructure/
│   └── docker/        # Docker configs
├── docker-compose.yml
└── .env.example
```

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion, React Flow, Recharts, TanStack Query, Zustand |
| **Backend** | NestJS 10, TypeORM, Passport JWT, class-validator, Swagger/OpenAPI |
| **Database** | PostgreSQL 16, Neo4j 5, Redis 7 |
| **Queue** | BullMQ + Redis |
| **Realtime** | Socket.IO (WebSocket) |
| **Blockchain** | Multi-provider abstraction (Alchemy, Infura, TronGrid, Etherscan) |
| **Auth** | JWT access/refresh tokens, bcrypt, RBAC, MFA-ready |
| **DevOps** | Docker, docker-compose |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd chainsentinel-ai

# Copy environment file
cp .env.example .env

# Start databases
docker compose up -d

# Install dependencies
pnpm install

# Run database migrations and seed
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm dev
```

This starts:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Docs: http://localhost:3001/docs
- Neo4j Browser: http://localhost:7474

### Docker Setup (Full Stack)

```bash
docker compose up -d
```

## 🔑 Default Users

After running the seed script, the following users are created. **Change passwords immediately in production.**

| Role | Email |
|------|-------|
| Super Admin | admin@chainsentinel.gov.in |
| Supervisor | supervisor@chainsentinel.gov.in |
| Investigator | investigator@chainsentinel.gov.in |

## 📋 Features

### Core Investigation Pipeline
1. **Wallet Submission** → Accept victim-reported wallet addresses
2. **Blockchain Detection** → Auto-detect chain from address format
3. **Transaction Ingestion** → Fetch and normalize blockchain transactions
4. **Graph Generation** → Build transaction relationship graph in Neo4j
5. **Fund-Flow Tracing** → BFS/DFS forward and backward tracing with cycle detection
6. **Intermediary Detection** → Identify burner/intermediary wallets
7. **Cross-Chain Analysis** → Detect bridge interactions and chain transfers
8. **VASP Attribution** → Match wallets to known entities with confidence scoring
9. **Risk Scoring** → Explainable multi-factor risk assessment
10. **Fraud Pattern Detection** → Rapid forwarding, fan-out, fan-in, layering
11. **Case Correlation** → Link related complaints and investigations
12. **Recommendations** → Evidence-based investigative recommendations

### UI/UX
- **Cyber-intelligence command center** dark theme
- **Animated dashboard** with real-time metrics
- **Interactive transaction graph** with node types, zoom, pan
- **Investigation wizard** with step-by-step progress
- **Live trace screen** with real-time pipeline progress
- **VASP attribution card** with confidence breakdown
- **Risk assessment** with explainable factors
- **Alert center** with severity filtering
- **Watchlist** management with monitoring
- **PDF report generation** with SHA-256 integrity
- **Global search** with command palette (⌘K)
- **Responsive design** for desktop/tablet
- **Accessibility** (keyboard nav, ARIA, reduced-motion)

### Security
- JWT access + refresh token rotation
- Role-based access control (6 roles)
- Case-level authorization
- Password hashing (bcrypt, 12 rounds)
- API rate limiting
- Input validation (class-validator)
- CORS configuration
- CSP headers
- Audit logging
- Provider secrets server-side only

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/logout-all` | Logout all sessions |

### Cases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cases` | List cases |
| POST | `/api/cases` | Create case |
| GET | `/api/cases/:id` | Get case |
| GET | `/api/cases/stats` | Case statistics |
| PATCH | `/api/cases/:id/status` | Update status |

### Investigations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/investigations` | Start investigation |
| GET | `/api/investigations` | List investigations |
| GET | `/api/investigations/:id` | Get investigation |
| GET | `/api/investigations/:id/jobs` | Get pipeline jobs |

### Wallets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallets/search` | Search wallets |
| GET | `/api/wallets/:address` | Get wallet |
| GET | `/api/wallets/:address/transactions` | Transactions |
| GET | `/api/wallets/:address/risk` | Risk assessment |
| GET | `/api/wallets/:address/attribution` | VASP attribution |

### Graph
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/graph/build` | Build graph for address |
| GET | `/api/graph/case/:caseId` | Get case graph |
| POST | `/api/graph/trace/forward` | Trace forward |
| POST | `/api/graph/trace/backward` | Trace backward |

### Alerts, Watchlist, VASP, Reports, Search, Health, Admin
Full CRUD for all entities. See `/docs` for Swagger documentation.

## 🗃️ Database Models

### PostgreSQL
- User, Organization, Session
- Case, Complaint
- Investigation, InvestigationJob
- Wallet, NormalizedTransaction
- VASP, Attribution
- RiskAssessment, FraudPattern
- CrossChainTransfer
- WatchlistEntry
- Alert
- Report
- WalletCluster
- AuditLog

### Neo4j
- Wallet nodes, Entity nodes, VASP nodes
- SENT_TO, RECEIVED_FROM, BRIDGED_TO relationships
- Wallet clusters, fund-flow paths

## 🔧 Environment Variables

See `.env.example` for all configuration. Key variables:

```env
DATABASE_URL=postgresql://...
NEO4J_URI=bolt://localhost:7687
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
ALCHEMY_API_KEY=your-key
TRONGRID_API_KEY=your-key
```

## 🧪 Testing

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests (Playwright)
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## 📊 Investigation Pipeline

```
INVESTIGATION_REQUESTED
        ↓
ADDRESS_VALIDATION
        ↓
CHAIN_DETECTION
        ↓
TRANSACTION_INGESTION
        ↓
TRANSACTION_NORMALIZATION
        ↓
GRAPH_BUILD
        ↓
FUND_FLOW_TRACE
        ↓
ENTITY_MATCHING
        ↓
CROSS_CHAIN_ANALYSIS
        ↓
PATTERN_ANALYSIS
        ↓
RISK_SCORING
        ↓
VASP_ATTRIBUTION
        ↓
CASE_CORRELATION
        ↓
RECOMMENDATION_GENERATION
        ↓
INVESTIGATION_COMPLETED
```

## 🎯 Acceptance Test Workflow

```
Login as Investigator
  → Create new cyber fraud case
  → Enter suspect wallet
  → Start investigation
  → Automatically identify blockchain
  → Load blockchain transactions
  → Generate transaction graph
  → Discover connected wallets
  → Detect suspicious intermediary wallet
  → Identify bridge/DEX interaction
  → Continue tracing
  → Match known entity/VASP
  → Calculate attribution confidence
  → Calculate wallet risk
  → Display explainable risk factors
  → Generate realtime alert
  → Add suspect wallet to watchlist
  → Open interactive graph
  → Inspect transaction evidence
  → Generate investigation recommendations
  → Generate PDF report
  → Verify evidence hash
  → Verify audit log
```

## 📝 License

This project is developed for Smart India Hackathon (SIH) 2026.

---

**ChainSentinel AI** — *Trace the Money. Identify the Exit. Accelerate the Investigation.*
