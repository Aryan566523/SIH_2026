# ChainSentinel AI — Final Sprint Prompt: Complete the MVP Demo

## Context for AI Code Generator

You are working on an existing monorepo project called **ChainSentinel AI** (SIH Problem Statement 26183). The foundational scaffolding is already built — database entities, authentication, RBAC, UI page shells matching the sidebar navigation (**Command Center, Investigations, New Investigation, Transaction Graph, VASP Intelligence, Wallet Intelligence, Fraud Campaigns, Cross-Chain Monitor, Watchlist, Reports, Administration, Settings, Blockchain Explorer**), the 14-stage pipeline definition, pre-seeded test accounts, and the general monorepo structure (Next.js frontend, NestJS backend, shared types). **None of that needs to be recreated. Authentication and the login flow are already fully implemented and working — do not touch, rebuild, or reference login work in any way.**

What is **NOT done** and must be completed in this sprint is everything that makes the platform actually **functional, interactive, and demo-worthy**. The system currently has structure but no working behavior — pages exist but don't fetch real data, the pipeline is defined but doesn't execute, the blockchain API registry exists as a schema but has no dynamic resolution logic, graphs don't render with real traced data, and reports don't generate.

**Time constraint:** Half a day. Every feature must be built for demo viability — functional enough to walk through a live case from submission to report generation in front of judges. Production polish is not required. Working demo flow is mandatory.

**IMPORTANT — UI Page Map (already scaffolded, use these exact routes/labels):**

| Sidebar Label | Route | Notes |
|---|---|---|
| Command Center | `/dashboard` | Main KPI dashboard, matches existing screenshot layout |
| Investigations | `/dashboard/investigations` and `/dashboard/investigations/[id]` | List + detail |
| New Investigation | `/dashboard/new-investigation` | Wizard |
| Transaction Graph | `/dashboard/graph` | React Flow visualizer |
| VASP Intelligence | `/dashboard/vasp` | VASP directory |
| Wallet Intelligence | `/dashboard/wallets` and `/dashboard/wallets/[address]` | List + detail |
| Fraud Campaigns | `/dashboard/fraud-campaigns` | Groups related investigations/cases into a campaign view |
| Cross-Chain Monitor | `/dashboard/cross-chain` | Bridge hop analysis |
| Watchlist | `/dashboard/watchlist` | Monitored wallets |
| Reports | `/dashboard/reports` | Forensic report list/view |
| Administration | `/dashboard/admin` | Tabs: Users, Organizations, Blockchain Providers, Audit Logs |
| Settings | `/dashboard/settings` | Tabs: Profile, Notifications, System Health |
| Blockchain Explorer | `/dashboard/explorer` | Search by wallet/tx/case |
| (linked from Command Center "View All" on Recent Alerts, not in primary sidebar) | `/dashboard/alerts` | Full alert center |

Every backend endpoint and frontend wiring task below must target these exact routes/labels. Do not invent alternate page names.

---

## TASK 1: Dynamic Blockchain API Registry — Full Working Implementation

### What Needs to Happen

The **Blockchain Providers** tab inside **Administration** (`/dashboard/admin` → tab "Blockchain Providers") must become a fully functional CRUD interface where an admin can add any blockchain platform's API by simply filling out a form with the platform name, API endpoint, API key, and an example wallet address. When saved, this configuration is stored in the database and immediately used by the investigation pipeline for any future wallet submitted on that chain.

### Specific Requirements

**Backend — `blockchain-config` module in NestJS:**

Create a service (`BlockchainConfigService`) that:
- Stores and retrieves blockchain API configurations from the database (the `blockchain_api_configs` table entity already exists)
- Exposes CRUD endpoints: `GET /blockchain-configs`, `GET /blockchain-configs/:id`, `POST /blockchain-configs`, `PUT /blockchain-configs/:id`, `DELETE /blockchain-configs/:id`
- Has a `POST /blockchain-configs/:id/test-connection` endpoint that makes a real HTTP call to the configured API endpoint with the example wallet address and returns success/failure with latency
- Has a `GET /blockchain-configs/auto-detect?address=<wallet>` endpoint that iterates through all active configs, runs the address against each config's regex validation pattern, and returns the matching chain with confidence

**Dynamic Provider Resolution — `BlockchainProviderFactory`:**

Create a factory service that:
- Takes a wallet address as input
- Calls auto-detect to determine which blockchain config matches
- Loads that config from the database (not hardcoded)
- Constructs the appropriate HTTP request to fetch transactions from the configured API endpoint
- Handles API key injection (replace `{API_KEY}` placeholder in endpoint URL with the stored key)
- Implements fallback logic: if primary endpoint fails, try fallback endpoints in order
- Returns normalized transaction data regardless of which provider was used

**The critical design principle:** The backend must NEVER have hardcoded blockchain provider logic. Every chain, every API endpoint, every address format rule comes from the database. If someone adds "Fantom" with its RPC endpoint through the UI, the system must be able to trace wallets on Fantom without any code change or restart.

**Frontend — Administration → Blockchain Providers tab:**

This tab must have:
- A table listing all configured blockchain APIs with columns: Chain Name, Chain ID, Native Token, Data Model, Primary API Provider Name, Status (green/yellow/red dot based on last health check), Active toggle, Actions (Edit, Test, Delete)
- An "Add Blockchain" button that opens a multi-step form:
  - Step 1: Select a template (Ethereum-like, Bitcoin UTXO, TRON-like, Solana-like, Custom) — selecting a template pre-fills common fields
  - Step 2: Basic info — chain name, chain ID, native token, data model radio (Account Model / UTXO Model)
  - Step 3: API configuration — primary provider name (text input), endpoint URL (text input with `{API_KEY}` placeholder hint), API key (password input), rate limit (number), timeout (number), plus an "Add Fallback Provider" repeater for up to 3 fallbacks
  - Step 4: Address validation — regex pattern (pre-filled from template), checksum type dropdown, address length, example address input with a "Validate Example" button that tests the regex
  - Step 5: VASP wallets — a dynamic table where admin can add rows with exchange name, comma-separated hot wallet addresses, jurisdiction, confidence slider (0-100%). Include an "Import from CSV" button
  - Step 6: Bridge contracts — dynamic table with bridge name, contract addresses, destination chain dropdown (populated from other active configs)
  - Step 7: DEX routers — dynamic table with DEX name, router addresses, swap event signature
  - Step 8: Review — summary of all entered data with a "Test Connection" button that calls the backend test endpoint and shows results inline, then "Save & Activate" button
- Edit mode: clicking Edit on any row opens the same form pre-filled with existing data
- Delete: confirmation modal before deletion
- Test Connection: clicking Test on any row triggers the backend test and shows a toast with result

**Pre-seed the following blockchain configs into the database on startup (in the seeder):**

1. **Ethereum Mainnet** — Chain ID: 1, Token: ETH, Account Model, Etherscan API as primary (`https://api.etherscan.io/api?module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&sort=asc&apikey={API_KEY}`), address regex for 0x-prefixed 42-char hex, EIP-55 checksum, with WazirX/Binance/CoinDCX hot wallet addresses pre-populated
2. **TRON Mainnet** — Chain ID: TRX, Token: TRX, Account Model, TronGrid API as primary (`https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions`), address regex for T-prefixed 34-char base58, with known TRON exchange wallets
3. **Bitcoin Mainnet** — Chain ID: BTC, Token: BTC, UTXO Model, Blockchain.info API as primary (`https://blockchain.info/rawaddr/{ADDRESS}`), address regex for legacy and bech32 formats
4. **Polygon Mainnet** — Chain ID: 137, Token: MATIC, Account Model, Polygonscan API
5. **BNB Chain** — Chain ID: 56, Token: BNB, Account Model, BSCScan API
6. **Solana Mainnet** — Chain ID: SOL, Token: SOL, Account Model, Helius API or Solana public RPC

For the demo, if real API keys are not available, the system must gracefully fall back to **mock provider responses** — realistic, deterministic transaction data that demonstrates the pipeline without requiring live RPC access. The mock provider should be selected automatically when a config has no API key or when the test connection fails.

---

## TASK 2: Investigation Pipeline — Make It Actually Execute

### What Needs to Happen

When an investigator submits a suspect wallet address through the **New Investigation** wizard (`/dashboard/new-investigation`), the 14-stage pipeline must actually run asynchronously, update progress in real-time via WebSocket, and produce real results that populate the **Investigations** detail page, **Transaction Graph**, **Wallet Intelligence** pages, and **Reports**.

### Specific Requirements

**Pipeline Orchestrator (`apps/worker` or inline in `apps/api`):**

Build a `PipelineOrchestrator` service that:
- Receives a job containing `investigationId`, `suspectWalletAddress`, and optionally `cryptoType`
- Executes each of the 14 stages sequentially (with parallel execution for stages 10-11 which are independent)
- After each stage completes, updates the `investigations` table with `currentStage`, `progressPercentage` (calculated as `stageIndex / 14 * 100`), and `stageTimestamps`
- Emits a WebSocket event to the investigation's room (`investigation:{id}`) with stage name, progress percentage, a human-readable status message, and timestamp
- If any stage fails after 3 retries, marks the investigation as `FAILED`, records `failureStage` and `failureReason`, emits a failure WebSocket event, and stops

**Stage Implementations (what each stage must actually do):**

**Stage 1 — INVESTIGATION_REQUESTED:** Already handled by the POST endpoint. Just mark timestamp and emit event.

**Stage 2 — ADDRESS_VALIDATION:**
- Load all active blockchain configs from DB
- Run the submitted address against each config's `addressFormat.regex`
- If exactly one match: proceed with that chain
- If multiple matches (e.g., Ethereum and Polygon both match 0x format): use chain ID hint from the submission form, or default to Ethereum
- If no match: fail with "Unsupported address format"
- Store detected chain on the investigation record

**Stage 3 — CHAIN_DETECTION:**
- Load the matched blockchain config
- Attempt to call the configured API endpoint with the address to confirm it exists on-chain
- If the API call succeeds and returns data: confirmed
- If it fails: try fallback providers
- If all providers fail: check if mock provider should be used (flag in config or environment variable `USE_MOCK_PROVIDERS=true`)
- Store chain confirmation and basic address metadata (is it a contract, transaction count if available)

**Stage 4 — TRANSACTION_INGESTION:**
- Using the resolved blockchain config and provider, fetch all transactions for the address
- For Etherscan-like APIs: parse the JSON response, extract transaction list
- For UTXO APIs: parse inputs/outputs
- For mock provider: return the pre-built demo transaction set for the seeded suspect wallet
- Store raw transactions in the `normalized_transactions` table linked to this investigation
- Update investigation stats: `transactionCount`

**Stage 5 — TRANSACTION_NORMALIZATION:**
- For each raw transaction, apply the blockchain config's `txNormalizationRules`:
  - Divide value by `10^decimalPlaces` to get human-readable amount
  - Look up historical USD price for the token at the transaction's block timestamp (for demo, use a static conversion rate: 1 ETH = $3,350, 1 BTC = $67,000, 1 TRX = $0.12, 1 USDT = $1.00)
  - Classify transaction type: if `to` address matches a known DEX router from config → SWAP; if matches bridge contract → BRIDGE; if matches VASP hot wallet → DEPOSIT; if matches known mixer → MIXER; else → TRANSFER
- Update each transaction record with normalized values

**Stage 6 — GRAPH_BUILD:**
- Collect all unique addresses from transactions (both `from` and `to`)
- Create wallet records in the `wallets` table for any that don't already exist
- Build a graph data structure (JSON object with `nodes` array and `edges` array):
  - Each node: `{ id: address, label: entityLabel || 'Unknown', type: 'SUSPECT' | 'INTERMEDIARY' | 'EXCHANGE' | 'MIXER' | 'BRIDGE' | 'DEX' | 'UNKNOWN', riskLevel: ... }`
  - Each edge: `{ source: fromAddress, target: toAddress, amount: normalizedAmount, amountUsd: usdValue, token: tokenSymbol, timestamp: blockTimestamp, txHash: transactionHash, type: transactionType }`
- The suspect wallet node type is always `SUSPECT`
- Nodes matching VASP hot wallets from any blockchain config get type `EXCHANGE` and `label` set to exchange name
- Nodes matching bridge contracts get type `BRIDGE`
- Nodes matching DEX routers get type `DEX`
- Store the graph JSON on the investigation record (in `investigationData.graph` or a separate field)
- If Neo4j is available, also insert into Neo4j. If not, the JSON graph is sufficient for demo.
- Update investigation stats: `uniqueAddressCount`

**Stage 7 — FUND_FLOW_TRACE:**
- Using the graph data, perform BFS from the suspect wallet following outgoing edges (forward trace)
- Build trace paths: ordered sequences of `[address, amount, timestamp, hop_number]` from suspect to each endpoint
- Identify terminal nodes (nodes with no outgoing edges, or nodes that are exchanges/VASPs)
- Calculate for each path: total hops, total time elapsed, total value transferred, percentage of original amount reaching endpoint
- Also perform backward trace (BFS following incoming edges) to identify funding sources
- Store trace paths on investigation record

**Stage 8 — ENTITY_MATCHING:**
- For each unique address in the graph:
  - Check against all VASP hot wallet address lists across all active blockchain configs
  - If matched: assign entity label (exchange name) and confidence from config
  - Check against a hardcoded small list of known illicit addresses (for demo, include 5-10 known Tornado Cash contract addresses, OFAC-listed addresses)
  - If matched: assign label "Tornado Cash" or "OFAC Listed" with high risk flag
- Update wallet records with entity labels and confidence scores

**Stage 9 — CROSS_CHAIN_ANALYSIS:**
- Scan all transactions for interactions with bridge contracts (from blockchain configs)
- For each bridge interaction found:
  - Record: source chain, source address, bridge name, estimated destination chain (from config's bridge `destination` field), estimated amount
  - Create a `cross_chain_transfers` record
  - If the destination chain is also configured: attempt to look up transactions on the destination chain for the time window around the bridge transaction (±10 minutes) with matching value (for demo, use mock data showing the bridge output on the destination chain)
- Store cross-chain analysis results on investigation record
- For demo, the pre-seeded case should show a bridge from Ethereum to TRON via THORChain

**Stage 10 — PATTERN_ANALYSIS:**
- Analyze the transaction graph for these specific patterns:
  - **Rapid Forwarding:** Look for sequences of 3+ hops where each hop occurs within 5 minutes of the previous. Score: +30
  - **Fan-Out:** Look for any node that sends to 3+ different addresses in the same block or within 10 minutes. Score: +25
  - **Fan-In:** Look for any node that receives from 3+ different addresses within 10 minutes. Score: +20
  - **Mixer Interaction:** Any transaction to/from an address labeled as mixer. Score: +40
  - **Bridge Hopping:** Any cross-chain transfer detected in Stage 9. Score: +15 per hop
  - **DEX Swap Chain:** Sequential transactions through DEX routers. Score: +20
- Record each detected pattern with: pattern name, involved addresses, involved transactions, risk contribution points
- Store patterns on investigation record

**Stage 11 — RISK_SCORING:**
- Calculate composite risk score using the formula:
  - Start with base score of 20 (every reported suspect wallet has baseline risk)
  - Add pattern risk points from Stage 10
  - Add entity risk: +50 if any address is OFAC-listed, +40 if any address is known illicit, -30 if endpoint is a verified FIU-registered VASP
  - Add temporal risk: +20 if suspect wallet was first seen less than 30 days before the reported fraud date, +15 if average time between hops is less than 5 minutes
  - Add volume risk: +30 if traced amount is within 20% of reported fraud amount
  - Cap total at 100
- Classify: 0-25 LOW, 26-50 MEDIUM, 51-75 HIGH, 76-100 CRITICAL
- Create `risk_assessments` record with full factor breakdown
- Update wallet `riskScore` and `riskLevel`
- Update investigation record with risk score and level

**Stage 12 — VASP_ATTRIBUTION:**
- For each VASP/exchange found as an endpoint in the trace paths (Stage 7):
  - Calculate attribution confidence based on hop distance:
    - Direct deposit (1 hop from suspect): 0.95
    - 2 hops: 0.85
    - 3 hops: 0.70
    - 4-5 hops: 0.55
    - 6+ hops: 0.40
    - Mixer in path: reduce by 0.30 (minimum 0.10)
  - Calculate traceable amount (amount that reached the VASP wallet)
  - Classify: confidence ≥ 0.80 → SERVEABLE, 0.50-0.79 → REFERABLE, <0.50 → UNRESOLVED
- Create `attributions` records
- Update investigation record with attributed VASPs list

**Stage 13 — CASE_CORRELATION:**
- Query the database for other investigations that share any wallet address with the current investigation's graph
- Query for other cases with the same VASP endpoint
- If matches found: create linkage records and note on investigation
- For demo, this can return empty or show correlation with the pre-seeded case
- Any linked cases should surface in the **Fraud Campaigns** page as a grouped campaign (see Task 3)

**Stage 14 — RECOMMENDATION_GENERATION & INVESTIGATION_COMPLETED:**
- Based on attribution results, generate recommendation text:
  - For SERVEABLE attributions: "Issue Section 91 CrPC notice to [VASP name] for immediate account freeze and transaction records disclosure. Contact nodal officer: [name, email, phone from VASP record]."
  - For REFERABLE: "Escalate to senior investigator for manual verification. Confidence level insufficient for direct notice."
  - For UNRESOLVED: "Add suspect wallet to watchlist for continuous monitoring. Coordinate with international LEAs if cross-border exchange involvement suspected."
- Generate a forensic report:
  - Compile all investigation data into a structured report object: case details, suspect wallet analysis, transaction summary (count, total volume, date range), graph topology summary (node count, edge count), trace paths, detected patterns, risk assessment with factor breakdown, VASP attributions with confidence, cross-chain analysis, recommendations
  - Calculate SHA-256 hash of the report content for integrity verification
  - Store as a `reports` record with status DRAFT
- Mark investigation as `INVESTIGATION_COMPLETED`
- Emit completion WebSocket event with summary data (risk score, top VASP attribution, recommendation headline)
- Create alert records for any CRITICAL or HIGH findings

**For the pre-seeded demo case**, ensure the pipeline produces these specific results when run against the suspect wallet `0x1234567890abcdef1234567890abcdef12345678`:
- 4 intermediary hops detected
- Rapid forwarding pattern (3 hops in 5 minutes)
- Fan-out at hop 2 (splits into 2 paths)
- One path goes through Tornado Cash mixer
- Other path goes through Uniswap V3 swap (ETH → USDT)
- Then through THORChain bridge to TRON
- Final destination: WazirX hot wallet on TRON
- Risk score: 78 (CRITICAL)
- Attribution: WazirX at confidence 0.95 (SERVEABLE)
- Recommendation: Section 91 CrPC notice to WazirX

---

## TASK 3: Frontend Pages — Wire Up to Real Backend Data

Every page listed in the UI Page Map must fetch and render real data using `@tanstack/react-query`, with client state in Zustand stores. **Do not modify or reference the login page/flow — it is already complete.**

### Page 1 — Command Center (`/dashboard`)

Match the existing layout exactly:
- **KPI cards** (6 total, exactly as in current UI): Active Investigations, Critical Alerts, Suspect Wallets, VASP Matches, Watchlisted Wallets, Cases — all fetched from `GET /dashboard/stats`
- **Risk Distribution** widget: horizontal bars for Critical / High / Medium / Low wallet counts, fetched from `GET /dashboard/charts/risk-distribution`
- **Blockchain Activity** panel: chart of transaction volume/activity per chain, fetched from `GET /dashboard/charts/volume-by-chain`. Must show a real chart once at least one investigation has completed (replace the current "No blockchain data yet" empty state)
- **Live Investigation Feed**: connects to WebSocket `global:activity`, displays real-time entries like "Funds reached known VASP" with relative timestamps ("24m ago"). On mount, hydrate from `GET /dashboard/activity?limit=10`
- **Recent Alerts** section (below the fold): latest alerts with severity color, title, relative time, and a "View All" link that navigates to `/dashboard/alerts`. Connects to WebSocket `global:alert` for live updates
- A "LIVE" badge in the top-right must pulse green when the WebSocket connection is active, and turn gray/red if disconnected

### Page 2 — New Investigation (`/dashboard/new-investigation`)

- Step 1 (Case Details): All form fields validated client-side before "Next". NCRP ref number format: `NCRP-YYYY-XXXXXX`. Phone must be valid Indian format.
- Step 2 (Suspect Wallet): Debounce 500ms on input, then call `GET /blockchain-configs/auto-detect?address=<input>`. Display detected chain name/icon or "Unknown format" warning. Manual chain selection dropdown (populated from `GET /blockchain-configs?isActive=true`) as fallback.
- Step 3 (Review & Submit): Show summary. On "Submit", call `POST /investigations`. Loading spinner. On success, redirect to `/dashboard/investigations/[newId]` where the pipeline begins running.

### Page 3 — Investigations (`/dashboard/investigations` list + `/dashboard/investigations/[id]` detail)

**List view:** fetch from `GET /investigations` with filters (status, risk level, date range), paginated table with case ref, suspect wallet (truncated), chain, status badge, risk badge, created date, link to detail.

**Detail view:**
- On mount, fetch `GET /investigations/:id`
- Connect to WebSocket room `investigation:{id}`
- **Left sidebar (40%):** vertical stepper of 14 stages (checkmark/spinner/clock/X per status, duration from timestamps, status message), overall circular progress %, key metric cards (Detected Chain, Transaction Count, Unique Addresses, Risk Score with color, Risk Level badge)
- **Right section (60%):** Live Alert Feed (listens for `investigation:alert`), Counterparties table (top addresses by volume, with Entity Label and Risk Flag), Action buttons: "View Full Graph" (→ `/dashboard/graph?investigation={id}`), "Generate Report" (`GET /investigations/:id/report`), "Download PDF" (`GET /investigations/:id/report/pdf`), "Generate Section 91 Notice" (`POST /investigations/:id/generate-notice`)

### Page 4 — Transaction Graph (`/dashboard/graph`)

- Accept query param `?investigation={id}`
- Fetch graph JSON from the investigation record (or `GET /wallets/:suspectWalletId/graph`)
- Render using React Flow with custom node components per type:
  - SUSPECT: red octagon + warning icon
  - EXCHANGE: green rectangle + bank icon
  - MIXER: purple diamond + shuffle icon
  - BRIDGE: blue hexagon + link icon
  - DEX: orange rounded rectangle + swap icon
  - INTERMEDIARY: yellow circle
  - UNKNOWN: gray circle
- Nodes show truncated address, entity label, risk-level dot
- Edges show amount + token, arrow direction, color by type (green transfer, orange swap, blue bridge, red mixer)
- Toolbar: zoom in/out, fit view, filter by node type, color-by selector (risk/entity/blockchain), export as PNG
- Minimap bottom-right
- Click node → detail panel (address, entity label, total received/sent, risk score, link to Wallet Intelligence page)
- Click edge → tooltip with tx hash, amount, timestamp, block number, link to block explorer

### Page 5 — VASP Intelligence (`/dashboard/vasp`)

- Fetch from `GET /vasps` with filters
- Card grid (3 cols desktop, 1 mobile): VASP name, jurisdiction with flag emoji, supported blockchains as icons, KYC badge, confidence progress bar, verification badge
- Click card → expand/navigate to detail with nodal officer contact, known wallet addresses table, attribution history (investigations where attributed)
- Admin users see "Add VASP" / "Edit" buttons

### Page 6 — Wallet Intelligence (`/dashboard/wallets` list + `/dashboard/wallets/[address]` detail)

**List view:** searchable/filterable table of known wallets with address, chain, risk badge, entity label, last activity.

**Detail view:**
- Fetch `GET /wallets?address={address}` then `GET /wallets/:id`; if not present, create on-the-fly
- **Left panel (35%):** metadata (total received/sent, balance, first/last seen, tx count), large circular risk gauge (0-100, color gradient), risk level badge, expandable risk factors list, detected fraud pattern badges
- **Right panel (65%):** transaction history from `GET /wallets/:id/transactions` — Date, From, To, Amount, Token, USD Value, Type badge, Risk Flag; sortable, paginated (20/page), row expands to full tx hash linked to block explorer

### Page 7 — Fraud Campaigns (`/dashboard/fraud-campaigns`)

New functional page grouping related investigations (linked via Stage 13 case correlation or shared fraud typology, e.g. same scam category or same attributed VASP):
- Fetch from `GET /fraud-campaigns` (create this endpoint — groups investigations by shared VASP endpoint, shared wallet, or same `fraudCategory` field)
- Card/list view: Campaign name (derived from common fraud type, e.g. "FxProMax Investment Scam Network"), number of linked cases, total traced volume, common VASP/exchange, risk level, list of linked investigation IDs with links
- Click a campaign → expanded view showing all linked investigations, a combined mini-graph (merged nodes/edges across cases), and shared entity list
- Empty state: if no correlations exist yet, show a friendly message ("No fraud campaigns detected yet — campaigns are automatically created when investigations share wallets or VASP endpoints")

### Page 8 — Cross-Chain Monitor (`/dashboard/cross-chain`)

- Fetch from `GET /cross-chain-transfers?investigationId={id}`
- Visual flow diagram: Source Chain icon → Bridge name/logo → Destination Chain icon, with amount/addresses below each
- Table: Source Chain, Source Address, Bridge, Destination Chain, Destination Address, Amount, Confidence, Status
- For demo, show the pre-seeded THORChain bridge from Ethereum to TRON

### Page 9 — Alert Center (`/dashboard/alerts`, linked from Command Center)

- Fetch from `GET /alerts` with filters for severity and status
- Table: Severity (color icon), Title, Message (truncated), Investigation link, Timestamp (relative), Status badge, Actions (Acknowledge, Archive)
- Click row → expand full alert details
- Bulk actions: select multiple → Mark Read, Acknowledge
- Real-time: new alerts appear at top via WebSocket (`global:alert`)

### Page 10 — Watchlist (`/dashboard/watchlist`)

- Fetch from `GET /watchlist`
- Table: Address, Blockchain, Added Date, Last Activity, Sensitivity Level badge, Risk Score, Actions (Remove, View Details)
- "Add to Watchlist" button → form: address input with auto-detect, sensitivity level selector (CRITICAL/HIGH/MEDIUM/LOW), notes textarea
- On submit, calls `POST /wallets/:id/add-to-watchlist`

### Page 11 — Reports (`/dashboard/reports`)

- Fetch from `GET /reports`
- Table: Report Name, Investigation link, Status badge (DRAFT/REVIEWED/APPROVED/SUBMITTED), Created By, Date, Actions
- "View" → formatted read-only report view: Executive Summary, Case Details, Suspect Wallet Analysis, Fund Flow Trace (mini graph or path list), VASP Attributions, Risk Assessment, Detected Patterns, Recommendations, Evidence Integrity (SHA-256 hash, timestamp, investigator signature)
- "Download PDF" → generate PDF from report content (HTML-to-PDF, browser print, `jspdf`, or server-side `puppeteer` if available)
- "Download JSON" → raw JSON export
- SERVEABLE attributions show a "Generate Section 91 Notice" button opening a pre-filled notice template with suspect wallet, VASP name, nodal officer details, estimated freeze amount, transaction evidence summary, 72-hour deadline

### Page 12 — Blockchain Explorer (`/dashboard/explorer`)

- Large centered search bar with tabs: Wallet Address | Transaction Hash | Case Number
- Wallet address → redirect to `/dashboard/wallets/[address]`
- Transaction hash → `GET /transactions?hash={hash}`, display result card (from, to, amount, token, block, timestamp, block explorer link)
- Case number → `GET /cases?ncrpRef={number}`, display case summary with link to investigation detail

### Page 13 — Settings (`/dashboard/settings`)

- Tab "Profile": user's own profile info, editable name/contact, change-password form
- Tab "Notifications": toggle preferences for alert severity levels that trigger in-app/toast notifications
- Tab "System Health": 4 status cards (API Server, Database, Graph DB, Queue), fetched from `GET /health`; Blockchain RPC Provider Status table from `GET /health/blockchain-providers` with a "Test All" button; auto-refresh every 30 seconds

### Page 14 — Administration (`/dashboard/admin`)

- **Tab 1 (Users):** `GET /admin/users`. Table: Name, Email, Role badge, Organization, Status, Actions. "Invite User" opens form. Edit opens modal with role selector, org selector, active toggle.
- **Tab 2 (Organizations):** `GET /admin/organizations`. Similar CRUD table.
- **Tab 3 (Blockchain Providers):** the Dynamic API Registry UI from Task 1 — the centerpiece feature.
- **Tab 4 (Audit Logs):** `GET /admin/audit-logs`. Read-only table: Timestamp, Actor, Action Type, Affected Entity, IP Address, Status, expandable Details. Filters for date range, action type, actor. Export to CSV.

---

## TASK 4: Backend Endpoints That Need to Be Created or Completed

**Dashboard Stats & Charts:**
- `GET /dashboard/stats` — returns: `activeInvestigations`, `criticalAlerts`, `suspectWallets`, `vaspMatches`, `watchlistedWallets`, `cases` (exact fields matching the Command Center KPI cards)
- `GET /dashboard/activity?limit=N` — recent system events for Live Investigation Feed
- `GET /dashboard/charts/volume-by-chain` — transaction volume grouped by blockchain (Blockchain Activity panel)
- `GET /dashboard/charts/risk-distribution` — wallet count grouped by risk level (Critical/High/Medium/Low)
- `GET /dashboard/charts/investigation-status` — investigation count grouped by status
- `GET /dashboard/charts/attribution-trend` — daily attribution success rate, last 30 days

**Fraud Campaigns:**
- `GET /fraud-campaigns` — groups investigations sharing a VASP endpoint, wallet address, or fraud category into campaign objects

**Cross-Chain:**
- `GET /cross-chain-transfers` — query params: `investigationId`, `page`, `limit`

**Watchlist:**
- `GET /watchlist` — all wallets where `isOnWatchlist = true`, paginated
- (Wallet add/remove from watchlist endpoints should already exist per the entity spec)

**Health:**
- `GET /health` — subsystem status object with latencies and connection states
- `GET /health/blockchain-providers` — status of each active blockchain config's RPC endpoint

**Transaction Search:**
- `GET /transactions?hash={hash}` — search by transaction hash across all normalized transactions

**Reports:**
- `GET /investigations/:id/report/pdf` — generate and return PDF of the forensic report. Must include: title page with ChainSentinel logo and investigation ID, executive summary, case details, fund flow path listing, VASP attribution table, risk score breakdown, detected patterns, recommendations, SHA-256 integrity hash at the bottom of the last page, investigator name + timestamp as digital signature.

**Notice Generation:**
- `POST /investigations/:id/generate-notice` — body: `{ vaspId, noticeType }`. Returns a pre-filled Section 91 CrPC notice as JSON (and optionally HTML) with: addressed to VASP nodal officer, re: investigation number and NCRP case number, suspect wallet address, estimated amount for freezing, list of supporting transaction hashes, request for account details/transaction records, 72-hour compliance deadline.

---

## TASK 5: WebSocket Real-Time Events

Set up a NestJS WebSocket gateway supporting room-based event streaming.

**Rooms:**
- `investigation:{investigationId}` — pipeline events for one investigation
- `global:activity` — Command Center activity feed
- `global:alert` — Command Center / Alert Center new alerts

**Events to Emit:**

From the pipeline orchestrator:
- `investigation:stage-update` → `{ investigationId, stage, progressPercentage, message, timestamp }`
- `investigation:alert` → `{ investigationId, severity, title, message, walletAddress, timestamp }`
- `investigation:completed` → `{ investigationId, riskScore, riskLevel, topVasp, confidence, recommendation, timestamp }`
- `investigation:failed` → `{ investigationId, failureStage, errorMessage, timestamp }`

From alert creation:
- `global:alert` → `{ alertId, severity, title, message, investigationId, timestamp }`

From any significant action:
- `global:activity` → `{ actorName, actionType, entityType, entityId, message, timestamp }`

**Frontend Connection:**
- On `/dashboard` (Command Center): connect to `global:activity` and `global:alert`
- On `/dashboard/investigations/[id]`: connect to `investigation:{id}`
- On `/dashboard/alerts`: connect to `global:alert`
- Use Socket.IO client via a custom hook (`useSocket`) or Zustand store

---

## TASK 6: Demo Flow Script — Ensure This Exact Walkthrough Works

Assume the user is **already authenticated** (login flow is complete and out of scope). The demo starts at the Command Center.

1. **Command Center loads** (`/dashboard`) with KPI cards showing non-zero data from the pre-seeded case, Risk Distribution bars populated, Blockchain Activity chart rendered, Live Investigation Feed showing recent events, Recent Alerts populated
2. **Click "New Investigation"** in sidebar → wizard opens
3. **Fill Step 1:** NCRP-2026-000483, "Priya Sharma", +91-9876-543211, "Investment Scam", "Victim lost 25,000 USDT to fake crypto trading platform FxProMax", 25000, USDT
4. **Fill Step 2:** Paste `0xabcdef1234567890abcdef1234567890abcdef12` → auto-detect shows "Ethereum Mainnet ✅" → Next
5. **Step 3:** Review summary → click "Submit Investigation"
6. **Redirect to Investigations detail page** → pipeline begins → stages update in real-time (checkmarks appearing, spinner on current stage, progress bar filling)
7. **Within 30-60 seconds** (demo speed), pipeline completes all 14 stages
8. **Investigation Detail shows:** Risk Score 72 (HIGH), 3 patterns detected (Rapid Forwarding, Fan-Out, DEX Swap), 1 VASP attributed (Binance, confidence 0.85, SERVEABLE)
9. **Click "View Full Graph"** → Transaction Graph loads with ~8-12 nodes, colored by type, edges showing fund flow
10. **Click the exchange node** → detail panel shows "Binance Hot Wallet", total deposited amount, confidence
11. **Navigate back to Investigation Detail** → Click "Generate Report" → report appears
12. **View Report** (`/dashboard/reports`) → formatted investigation summary with all sections, SHA-256 hash at bottom
13. **Click "Generate Section 91 Notice"** → notice template appears with Binance details pre-filled
14. **Navigate to Administration → Blockchain Providers tab** → shows list of 6 pre-configured chains
15. **Click "Add Blockchain"** → select "Ethereum-like" template → fill: "Fantom Opera", Chain ID 250, FTM, paste Ftmscan API URL → Test Connection → green checkmark → Save & Activate → Fantom appears in the table
16. **Navigate back to Command Center** → KPI cards updated with new investigation data
17. **Navigate to Alert Center** (via "View All" from Command Center Recent Alerts) → shows alerts from the completed investigation
18. **Navigate to Fraud Campaigns** → if correlated cases exist, show grouped campaign view

For this flow to work, ensure:
- The second demo wallet (`0xabcdef1234567890abcdef1234567890abcdef12`) has pre-built mock data in the mock provider that traces through 4 intermediaries, includes a Uniswap swap, and ends at a Binance hot wallet
- The pipeline runs at accelerated demo speed (each stage completes in 2-5 seconds, total pipeline ~45 seconds)
- All pages handle loading states gracefully (skeletons or spinners, not blank screens)
- All pages handle empty states gracefully (meaningful messages, not broken layouts)

---

## TASK 7: Mock Data Provider — Complete and Deterministic

Create a `MockBlockchainProvider` that implements the same `IBlockchainProvider` interface as real providers but returns pre-built, deterministic data.

**Requirements:**
- Activated when `USE_MOCK_PROVIDERS=true` in environment, OR when a blockchain config has no API key, OR when real API call fails
- For the primary demo wallet (`0x1234567890abcdef1234567890abcdef12345678`), return exactly the transaction set described in Task 2's demo case (50 ETH flowing through intermediaries, splitting, going through mixer and DEX, bridging to TRON, depositing at WazirX)
- For the secondary demo wallet (`0xabcdef1234567890abcdef1234567890abcdef12`), return a different but equally rich transaction set (25,000 USDT flowing through 4 intermediaries with rapid forwarding, a Uniswap V3 swap, and ending at Binance)
- For any other address: generate a plausible but minimal set of 5-10 transactions with random intermediaries, leading to one of the pre-configured VASP wallets, to ensure the pipeline always has data to work with
- All mock data must have consistent timestamps (within the last 30 days), realistic amounts, proper token symbols, and valid-looking (but fake) transaction hashes

---

## TASK 8: Presentation Slide Update

The last slide of the presentation needs to be updated. Generate content for a final slide titled **"Impact & Future Roadmap"** with two sections:

**Demonstrated Capabilities (MVP):**
- Dynamic multi-chain blockchain API integration (add any chain via UI)
- Real-time 14-stage automated investigation pipeline
- Explainable risk scoring with court-defensible factor breakdown
- VASP attribution with confidence-ranked exchange identification
- Cross-chain bridge tracking (THORChain, Stargate, LayerZero)
- Court-ready forensic reports with SHA-256 integrity hashing
- Section 91 CrPC notice auto-generation
- 6-role RBAC with immutable audit logging

**Future Roadmap (Post-Hackathon):**
- Direct NCRP / 1930 Helpline API integration for automated case ingestion
- SAHYOG platform bidirectional integration
- ML-based pattern detection (GNN for transaction graph anomaly detection)
- Automated VASP nodal officer notification system
- Mobile companion app for field investigators
- Scalable PostgreSQL + distributed Redis deployment for 10,000+ cases/day
- Interpol / international LEA coordination module
- Privacy-preserving analytics (zero-knowledge proofs for cross-agency data sharing)

---

## Critical Constraints

1. **No hardcoded blockchain logic.** Every chain interaction must flow through the dynamic blockchain config from the database. The entire point of the Dynamic API Registry feature is that adding a new blockchain is a UI operation, not a code operation.

2. **Mock provider is the default for demo.** Do not assume live API keys. The system must work completely with mock data out of the box. Real API integration is a bonus, not a requirement.

3. **SQLite for demo.** Do not require PostgreSQL, Redis, or Neo4j for the demo to function. All must have in-memory or SQLite fallbacks. The system should start with `pnpm dev` and work immediately.

4. **Every page must show data.** No blank pages, no "coming soon" placeholders. Every page in the sidebar (Command Center, Investigations, New Investigation, Transaction Graph, VASP Intelligence, Wallet Intelligence, Fraud Campaigns, Cross-Chain Monitor, Watchlist, Reports, Administration, Settings, Blockchain Explorer) must render meaningful content — either from the pre-seeded data or from a recently completed investigation.

5. **WebSocket events must fire.** The investigation detail page must show live progress. This is the single most impressive demo moment (watching stages complete in real-time) and must work flawlessly.

6. **The graph must be visually impressive.** The React Flow graph on Transaction Graph page with custom colored nodes and directed edges is the second most impressive demo moment. It must render correctly with the demo data showing a clear fund flow from suspect wallet through intermediaries to exchange.

7. **Report generation must work end-to-end.** Clicking "Generate Report" must produce a viewable, downloadable document (even if it's just well-formatted HTML/JSON). The SHA-256 hash must be real and verifiable.

8. **Section 91 notice must be pre-filled.** The legal notice template must contain actual data from the investigation — not lorem ipsum.

9. **Error handling must be graceful.** No unhandled promise rejections, no white screens of death, no cryptic error messages. Every failure state should show a user-friendly message with suggested action.

10. **Audit logging must capture every action.** Investigation creation, report generation, blockchain config changes, watchlist modifications, etc. — all must create audit log entries with actor, timestamp, IP, and action details.

11. **Do not touch authentication/login.** The login page, JWT flow, and auth store are already complete and out of scope for this sprint. Do not regenerate, refactor, or reference them in any implementation plan.



# ChainSentinel AI — Final Sprint Prompt: Complete the MVP Demo

## Context for AI Code Generator

You are working on an existing monorepo project called **ChainSentinel AI** (SIH Problem Statement 26183). The foundational scaffolding is already built — database entities, authentication, RBAC, UI page shells matching the sidebar navigation (**Command Center, Investigations, New Investigation, Transaction Graph, VASP Intelligence, Wallet Intelligence, Fraud Campaigns, Cross-Chain Monitor, Watchlist, Reports, Administration, Settings, Blockchain Explorer**), the 14-stage pipeline definition, pre-seeded test accounts, and the general monorepo structure (Next.js frontend, NestJS backend, shared types). **None of that needs to be recreated. Authentication and the login flow are already fully implemented and working — do not touch, rebuild, or reference login work in any way.**

What is **NOT done** and must be completed in this sprint is everything that makes the platform actually **functional, interactive, and demo-worthy**. The system currently has structure but no working behavior — pages exist but don't fetch real data, the pipeline is defined but doesn't execute, the blockchain API registry exists as a schema but has no dynamic resolution logic, graphs don't render with real traced data, and reports don't generate.

**IMPORTANT — Live API keys ARE available.** Real API keys for Etherscan, TronGrid, Blockchain.info, Polygonscan, BSCScan, and Solana/Helius are provided via environment variables and will be entered into the Blockchain Providers admin UI. **The system must prioritize and properly utilize these real, live API calls as the default data source.** Mock data is strictly a last-resort fallback — not a default shortcut — and must only activate when a config genuinely has no key configured, or a real call fails after retries/timeout. See the updated fallback rules and mandatory UI transparency indicator below.

**Time constraint:** Half a day. Every feature must be built for demo viability — functional enough to walk through a live case from submission to report generation in front of judges. Production polish is not required. Working demo flow is mandatory.

**UI Page Map (already scaffolded, use these exact routes/labels):**

| Sidebar Label | Route | Notes |
|---|---|---|
| Command Center | `/dashboard` | Main KPI dashboard, matches existing screenshot layout |
| Investigations | `/dashboard/investigations` and `/dashboard/investigations/[id]` | List + detail |
| New Investigation | `/dashboard/new-investigation` | Wizard |
| Transaction Graph | `/dashboard/graph` | React Flow visualizer |
| VASP Intelligence | `/dashboard/vasp` | VASP directory |
| Wallet Intelligence | `/dashboard/wallets` and `/dashboard/wallets/[address]` | List + detail |
| Fraud Campaigns | `/dashboard/fraud-campaigns` | Groups related investigations/cases into a campaign view |
| Cross-Chain Monitor | `/dashboard/cross-chain` | Bridge hop analysis |
| Watchlist | `/dashboard/watchlist` | Monitored wallets |
| Reports | `/dashboard/reports` | Forensic report list/view |
| Administration | `/dashboard/admin` | Tabs: Users, Organizations, Blockchain Providers, Audit Logs |
| Settings | `/dashboard/settings` | Tabs: Profile, Notifications, System Health |
| Blockchain Explorer | `/dashboard/explorer` | Search by wallet/tx/case |
| (linked from Command Center "View All" on Recent Alerts) | `/dashboard/alerts` | Full alert center |

Every backend endpoint and frontend wiring task below must target these exact routes/labels. Do not invent alternate page names.

---

## TASK 1: Dynamic Blockchain API Registry — Full Working Implementation, LIVE-first

### What Needs to Happen

The **Blockchain Providers** tab inside **Administration** (`/dashboard/admin` → tab "Blockchain Providers") must become a fully functional CRUD interface where an admin can add any blockchain platform's API by filling out a form with the platform name, API endpoint, API key, and an example wallet address. When saved, this configuration is stored in the database and **immediately used with the real, live API key** by the investigation pipeline for any wallet submitted on that chain.

### Live-API-First Data Resolution Rule (critical)

Every blockchain config supplied with a real API key (Etherscan, TronGrid, Blockchain.info, Polygonscan, BSCScan, Helius/Solana RPC, or any admin-added chain with a key) **must be called live** for every pipeline run. The resolution order for any data fetch is:

1. **Primary live endpoint** (with real API key injected) — attempt this first, always, if a key is present.
2. **Fallback live endpoints** (up to 3, in order defined by the config) — attempted only if the primary call fails, times out, or returns an error/rate-limit response.
3. **Mock provider** — used **only** if: (a) the config has no API key stored at all, or (b) every live endpoint (primary + all fallbacks) failed after retry, or (c) `USE_MOCK_PROVIDERS=true` is explicitly forced in environment for offline demo mode.

Every response returned by `BlockchainProviderFactory` — whether it came from a live call or the mock provider — must be tagged with a `dataSource: 'LIVE' | 'MOCK'` field, along with `providerName` (e.g. "Etherscan", "TronGrid", "Mock Provider") and, for live calls, the measured `latencyMs`. This tag must be persisted alongside the ingested transactions/investigation record (e.g. `investigation.dataSourceMeta`, `normalized_transactions.dataSource`) so the frontend can render it later — this is not a transient log-only value.

### Mandatory Mock/Live Transparency Indicator (new requirement)

Wherever mock data is used anywhere in the system, the UI **must visibly indicate it** — never silently pass off mock data as live data. Implement:

- A small **badge/pill** — e.g. amber `⚠ MOCK DATA` vs green `● LIVE` — rendered:
  - On the **Investigation Detail** page (Task 3, Page 3) next to the "Detected Chain" metric card, reflecting whether that investigation's transaction ingestion used live or mock data.
  - On the **Transaction Graph** page toolbar, as a persistent banner if any portion of the graph's underlying data is mock-sourced.
  - On the **Wallet Intelligence** detail page, next to the transaction history table.
  - On the **Reports** view, in the "Evidence Integrity" section (e.g. "Data Source: Etherscan (LIVE)" or "Data Source: Mock Provider (DEMO DATA — not sourced from live chain)").
  - On the **Administration → Blockchain Providers** table, as part of the Status column: a distinct icon/tag showing whether the last successful fetch for that chain was LIVE or MOCK (not just up/down health).
  - On **System Health** (`/dashboard/settings` → System Health tab) and `/dashboard/health` API — each blockchain provider row must show `dataSource: LIVE | MOCK` alongside latency.
- This flag must be queryable via API (include `dataSource` in the relevant investigation/wallet/transaction/report DTOs) so the frontend never has to guess — it renders exactly what the backend says was used.
- If a live call fails mid-pipeline and the orchestrator falls back to mock, emit a WebSocket `investigation:alert` event with a clear message like *"Live Etherscan API unavailable — falling back to mock data for demo continuity"* so the fallback is transparent in the live activity feed too, not hidden.

### Specific Requirements

**Backend — `blockchain-config` module in NestJS:**

Create a service (`BlockchainConfigService`) that:
- Stores and retrieves blockchain API configurations from the database (the `blockchain_api_configs` table entity already exists)
- Exposes CRUD endpoints: `GET /blockchain-configs`, `GET /blockchain-configs/:id`, `POST /blockchain-configs`, `PUT /blockchain-configs/:id`, `DELETE /blockchain-configs/:id`
- Has a `POST /blockchain-configs/:id/test-connection` endpoint that makes a **real HTTP call** to the configured API endpoint with the example wallet address, returns success/failure with latency, and explicitly returns `dataSource: 'LIVE'` on success or `dataSource: 'MOCK_FALLBACK'` with the failure reason if it had to fall back
- Has a `GET /blockchain-configs/auto-detect?address=<wallet>` endpoint that iterates through all active configs, runs the address against each config's regex validation pattern, and returns the matching chain with confidence

**Dynamic Provider Resolution — `BlockchainProviderFactory`:**

Create a factory service that:
- Takes a wallet address as input
- Calls auto-detect to determine which blockchain config matches
- Loads that config from the database (not hardcoded)
- Reads the config's stored API key and constructs the live HTTP request (replace `{API_KEY}` and `{ADDRESS}` placeholders)
- **Always attempts the live call first** when a key exists
- Implements fallback logic: if the primary endpoint fails or times out, try fallback endpoints in order; only drop to `MockBlockchainProvider` if all live options are exhausted or no key is configured
- Returns normalized transaction data plus the `dataSource`/`providerName`/`latencyMs` metadata regardless of which provider was used

**The critical design principle:** The backend must NEVER have hardcoded blockchain provider logic. Every chain, every API endpoint, every address format rule comes from the database. If someone adds "Fantom" with its RPC endpoint through the UI, the system must be able to trace wallets on Fantom without any code change or restart — and it must attempt that call live first.

**Frontend — Administration → Blockchain Providers tab:**

This tab must have:
- A table listing all configured blockchain APIs with columns: Chain Name, Chain ID, Native Token, Data Model, Primary API Provider Name, Status (green/yellow/red dot based on last health check **plus LIVE/MOCK tag**), Active toggle, Actions (Edit, Test, Delete)
- An "Add Blockchain" button that opens a multi-step form:
  - Step 1: Select a template (Ethereum-like, Bitcoin UTXO, TRON-like, Solana-like, Custom) — selecting a template pre-fills common fields
  - Step 2: Basic info — chain name, chain ID, native token, data model radio (Account Model / UTXO Model)
  - Step 3: API configuration — primary provider name (text input), endpoint URL (text input with `{API_KEY}` placeholder hint), API key (password input, masked, with a note "leave blank to force mock mode for this chain"), rate limit (number), timeout (number), plus an "Add Fallback Provider" repeater for up to 3 fallbacks
  - Step 4: Address validation — regex pattern (pre-filled from template), checksum type dropdown, address length, example address input with a "Validate Example" button that tests the regex
  - Step 5: VASP wallets — a dynamic table where admin can add rows with exchange name, comma-separated hot wallet addresses, jurisdiction, confidence slider (0-100%). Include an "Import from CSV" button
  - Step 6: Bridge contracts — dynamic table with bridge name, contract addresses, destination chain dropdown (populated from other active configs)
  - Step 7: DEX routers — dynamic table with DEX name, router addresses, swap event signature
  - Step 8: Review — summary of all entered data with a "Test Connection" button that calls the backend test endpoint and shows results inline (**explicitly showing "✅ LIVE connection confirmed" or "⚠ Falling back to mock — reason: ..."**), then "Save & Activate" button
- Edit mode: clicking Edit on any row opens the same form pre-filled with existing data (API key field shows masked placeholder, not the real value, unless explicitly revealed)
- Delete: confirmation modal before deletion
- Test Connection: clicking Test on any row triggers the backend test and shows a toast with result including data source used

**Pre-seed the following blockchain configs into the database on startup (in the seeder), with real API keys read from environment variables where provided:**

1. **Ethereum Mainnet** — Chain ID: 1, Token: ETH, Account Model, Etherscan API as primary (`https://api.etherscan.io/api?module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&sort=asc&apikey={API_KEY}`), key sourced from `ETHERSCAN_API_KEY` env var, address regex for 0x-prefixed 42-char hex, EIP-55 checksum, with WazirX/Binance/CoinDCX hot wallet addresses pre-populated
2. **TRON Mainnet** — Chain ID: TRX, Token: TRX, Account Model, TronGrid API as primary (`https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions`), key from `TRONGRID_API_KEY`, address regex for T-prefixed 34-char base58, with known TRON exchange wallets
3. **Bitcoin Mainnet** — Chain ID: BTC, Token: BTC, UTXO Model, Blockchain.info API as primary (`https://blockchain.info/rawaddr/{ADDRESS}`), address regex for legacy and bech32 formats
4. **Polygon Mainnet** — Chain ID: 137, Token: MATIC, Account Model, Polygonscan API, key from `POLYGONSCAN_API_KEY`
5. **BNB Chain** — Chain ID: 56, Token: BNB, Account Model, BSCScan API, key from `BSCSCAN_API_KEY`
6. **Solana Mainnet** — Chain ID: SOL, Token: SOL, Account Model, Helius API or Solana public RPC, key from `HELIUS_API_KEY`

If the corresponding environment variable is set with a real key at seed time, the seeder must populate that config's `apiKey` field so it is LIVE by default. If a key is missing for a given chain, that config seeds with an empty key and will correctly fall back to mock (and show the MOCK indicator) until an admin fills it in via the UI. **Do not force `USE_MOCK_PROVIDERS=true` globally** — this env var should default to `false` so the system attempts live calls wherever keys exist; it exists only as an explicit offline-demo override switch.

---

## TASK 2: Investigation Pipeline — Make It Actually Execute (LIVE-first)

### What Needs to Happen

When an investigator submits a suspect wallet address through the **New Investigation** wizard (`/dashboard/new-investigation`), the 14-stage pipeline must actually run asynchronously, calling real blockchain APIs wherever keys are configured, update progress in real-time via WebSocket, and produce real results that populate the **Investigations** detail page, **Transaction Graph**, **Wallet Intelligence** pages, and **Reports**.

### Specific Requirements

**Pipeline Orchestrator (`apps/worker` or inline in `apps/api`):**

Build a `PipelineOrchestrator` service that:
- Receives a job containing `investigationId`, `suspectWalletAddress`, and optionally `cryptoType`
- Executes each of the 14 stages sequentially (with parallel execution for stages 10-11 which are independent)
- After each stage completes, updates the `investigations` table with `currentStage`, `progressPercentage` (calculated as `stageIndex / 14 * 100`), and `stageTimestamps`
- Emits a WebSocket event to the investigation's room (`investigation:{id}`) with stage name, progress percentage, a human-readable status message, and timestamp
- If any stage fails after 3 retries, marks the investigation as `FAILED`, records `failureStage` and `failureReason`, emits a failure WebSocket event, and stops
- Persists a `dataSource` field on the investigation record summarizing whether ingestion used LIVE or MOCK data (and per-provider breakdown if multiple chains/bridges were involved)

**Stage Implementations (what each stage must actually do):**

**Stage 1 — INVESTIGATION_REQUESTED:** Already handled by the POST endpoint. Just mark timestamp and emit event.

**Stage 2 — ADDRESS_VALIDATION:**
- Load all active blockchain configs from DB
- Run the submitted address against each config's `addressFormat.regex`
- If exactly one match: proceed with that chain
- If multiple matches (e.g., Ethereum and Polygon both match 0x format): use chain ID hint from the submission form, or default to Ethereum
- If no match: fail with "Unsupported address format"
- Store detected chain on the investigation record

**Stage 3 — CHAIN_DETECTION:**
- Load the matched blockchain config
- **Attempt the real, live configured API endpoint first** (with the stored key) to confirm the address exists on-chain
- If the live call succeeds and returns data: confirmed, mark `dataSource: LIVE`
- If it fails: try live fallback providers in order
- If all live providers fail (or no key configured): fall back to `MockBlockchainProvider`, mark `dataSource: MOCK`, and emit a WebSocket alert noting the fallback occurred
- Store chain confirmation, data source, and basic address metadata (is it a contract, transaction count if available)

**Stage 4 — TRANSACTION_INGESTION:**
- Using the resolved blockchain config and provider (LIVE preferred), fetch all transactions for the address
- For Etherscan-like APIs: parse the real JSON response, extract transaction list
- For UTXO APIs: parse inputs/outputs from the real response
- For mock provider (only when live is unavailable): return the pre-built demo transaction set for the seeded suspect wallet
- Store raw transactions in the `normalized_transactions` table linked to this investigation, each tagged with `dataSource`
- Update investigation stats: `transactionCount`

**Stage 5 — TRANSACTION_NORMALIZATION:**
- For each raw transaction, apply the blockchain config's `txNormalizationRules`:
  - Divide value by `10^decimalPlaces` to get human-readable amount
  - Look up historical USD price for the token at the transaction's block timestamp (for demo, use a static conversion rate: 1 ETH = $3,350, 1 BTC = $67,000, 1 TRX = $0.12, 1 USDT = $1.00)
  - Classify transaction type: if `to` address matches a known DEX router from config → SWAP; if matches bridge contract → BRIDGE; if matches VASP hot wallet → DEPOSIT; if matches known mixer → MIXER; else → TRANSFER
- Update each transaction record with normalized values

**Stage 6 — GRAPH_BUILD:**
- Collect all unique addresses from transactions (both `from` and `to`)
- Create wallet records in the `wallets` table for any that don't already exist
- Build a graph data structure (JSON object with `nodes` array and `edges` array):
  - Each node: `{ id: address, label: entityLabel || 'Unknown', type: 'SUSPECT' | 'INTERMEDIARY' | 'EXCHANGE' | 'MIXER' | 'BRIDGE' | 'DEX' | 'UNKNOWN', riskLevel: ... }`
  - Each edge: `{ source: fromAddress, target: toAddress, amount: normalizedAmount, amountUsd: usdValue, token: tokenSymbol, timestamp: blockTimestamp, txHash: transactionHash, type: transactionType }`
- The suspect wallet node type is always `SUSPECT`
- Nodes matching VASP hot wallets from any blockchain config get type `EXCHANGE` and `label` set to exchange name
- Nodes matching bridge contracts get type `BRIDGE`
- Nodes matching DEX routers get type `DEX`
- Store the graph JSON on the investigation record (in `investigationData.graph` or a separate field), along with `dataSource` metadata
- If Neo4j is available, also insert into Neo4j. If not, the JSON graph is sufficient for demo.
- Update investigation stats: `uniqueAddressCount`

**Stage 7 — FUND_FLOW_TRACE:**
- Using the graph data, perform BFS from the suspect wallet following outgoing edges (forward trace)
- Build trace paths: ordered sequences of `[address, amount, timestamp, hop_number]` from suspect to each endpoint
- Identify terminal nodes (nodes with no outgoing edges, or nodes that are exchanges/VASPs)
- Calculate for each path: total hops, total time elapsed, total value transferred, percentage of original amount reaching endpoint
- Also perform backward trace (BFS following incoming edges) to identify funding sources
- Store trace paths on investigation record

**Stage 8 — ENTITY_MATCHING:**
- For each unique address in the graph:
  - Check against all VASP hot wallet address lists across all active blockchain configs
  - If matched: assign entity label (exchange name) and confidence from config
  - Check against a hardcoded small list of known illicit addresses (for demo, include 5-10 known Tornado Cash contract addresses, OFAC-listed addresses)
  - If matched: assign label "Tornado Cash" or "OFAC Listed" with high risk flag
- Update wallet records with entity labels and confidence scores

**Stage 9 — CROSS_CHAIN_ANALYSIS:**
- Scan all transactions for interactions with bridge contracts (from blockchain configs)
- For each bridge interaction found:
  - Record: source chain, source address, bridge name, estimated destination chain (from config's bridge `destination` field), estimated amount
  - Create a `cross_chain_transfers` record
  - If the destination chain is also configured with a real key: attempt a **live lookup** of transactions on the destination chain for the time window around the bridge transaction (±10 minutes) with matching value; if that live lookup fails or the destination chain has no key, use mock data showing the bridge output on the destination chain (tagged accordingly)
- Store cross-chain analysis results on investigation record
- For demo, the pre-seeded case should show a bridge from Ethereum to TRON via THORChain

**Stage 10 — PATTERN_ANALYSIS:**
- Analyze the transaction graph for these specific patterns:
  - **Rapid Forwarding:** Look for sequences of 3+ hops where each hop occurs within 5 minutes of the previous. Score: +30
  - **Fan-Out:** Look for any node that sends to 3+ different addresses in the same block or within 10 minutes. Score: +25
  - **Fan-In:** Look for any node that receives from 3+ different addresses within 10 minutes. Score: +20
  - **Mixer Interaction:** Any transaction to/from an address labeled as mixer. Score: +40
  - **Bridge Hopping:** Any cross-chain transfer detected in Stage 9. Score: +15 per hop
  - **DEX Swap Chain:** Sequential transactions through DEX routers. Score: +20
- Record each detected pattern with: pattern name, involved addresses, involved transactions, risk contribution points
- Store patterns on investigation record

**Stage 11 — RISK_SCORING:**
- Calculate composite risk score using the formula:
  - Start with base score of 20 (every reported suspect wallet has baseline risk)
  - Add pattern risk points from Stage 10
  - Add entity risk: +50 if any address is OFAC-listed, +40 if any address is known illicit, -30 if endpoint is a verified FIU-registered VASP
  - Add temporal risk: +20 if suspect wallet was first seen less than 30 days before the reported fraud date, +15 if average time between hops is less than 5 minutes
  - Add volume risk: +30 if traced amount is within 20% of reported fraud amount
  - Cap total at 100
- Classify: 0-25 LOW, 26-50 MEDIUM, 51-75 HIGH, 76-100 CRITICAL
- Create `risk_assessments` record with full factor breakdown
- Update wallet `riskScore` and `riskLevel`
- Update investigation record with risk score and level

**Stage 12 — VASP_ATTRIBUTION:**
- For each VASP/exchange found as an endpoint in the trace paths (Stage 7):
  - Calculate attribution confidence based on hop distance:
    - Direct deposit (1 hop from suspect): 0.95
    - 2 hops: 0.85
    - 3 hops: 0.70
    - 4-5 hops: 0.55
    - 6+ hops: 0.40
    - Mixer in path: reduce by 0.30 (minimum 0.10)
  - Calculate traceable amount (amount that reached the VASP wallet)
  - Classify: confidence ≥ 0.80 → SERVEABLE, 0.50-0.79 → REFERABLE, <0.50 → UNRESOLVED
- Create `attributions` records
- Update investigation record with attributed VASPs list

**Stage 13 — CASE_CORRELATION:**
- Query the database for other investigations that share any wallet address with the current investigation's graph
- Query for other cases with the same VASP endpoint
- If matches found: create linkage records and note on investigation
- For demo, this can return empty or show correlation with the pre-seeded case
- Any linked cases should surface in the **Fraud Campaigns** page as a grouped campaign (see Task 3)

**Stage 14 — RECOMMENDATION_GENERATION & INVESTIGATION_COMPLETED:**
- Based on attribution results, generate recommendation text:
  - For SERVEABLE attributions: "Issue Section 91 CrPC notice to [VASP name] for immediate account freeze and transaction records disclosure. Contact nodal officer: [name, email, phone from VASP record]."
  - For REFERABLE: "Escalate to senior investigator for manual verification. Confidence level insufficient for direct notice."
  - For UNRESOLVED: "Add suspect wallet to watchlist for continuous monitoring. Coordinate with international LEAs if cross-border exchange involvement suspected."
- Generate a forensic report:
  - Compile all investigation data into a structured report object: case details, suspect wallet analysis, transaction summary (count, total volume, date range), graph topology summary (node count, edge count), trace paths, detected patterns, risk assessment with factor breakdown, VASP attributions with confidence, cross-chain analysis, recommendations, **and a data provenance section listing which chains/stages used LIVE vs MOCK data**
  - Calculate SHA-256 hash of the report content for integrity verification
  - Store as a `reports` record with status DRAFT
- Mark investigation as `INVESTIGATION_COMPLETED`
- Emit completion WebSocket event with summary data (risk score, top VASP attribution, recommendation headline)
- Create alert records for any CRITICAL or HIGH findings

**For the pre-seeded demo case**, ensure the pipeline produces these specific results when run against the suspect wallet `0x1234567890abcdef1234567890abcdef12345678` (this specific address should always resolve deterministically via mock data regardless of live key availability, since it's a fixed demo fixture not expected to exist on real-chain history):
- 4 intermediary hops detected
- Rapid forwarding pattern (3 hops in 5 minutes)
- Fan-out at hop 2 (splits into 2 paths)
- One path goes through Tornado Cash mixer
- Other path goes through Uniswap V3 swap (ETH → USDT)
- Then through THORChain bridge to TRON
- Final destination: WazirX hot wallet on TRON
- Risk score: 78 (CRITICAL)
- Attribution: WazirX at confidence 0.95 (SERVEABLE)
- Recommendation: Section 91 CrPC notice to WazirX
- This investigation's dataSource must be explicitly tagged and displayed as `MOCK` (demo fixture), so it doesn't misrepresent itself as a live-traced case

---

## TASK 3: Frontend Pages — Wire Up to Real Backend Data

Every page listed in the UI Page Map must fetch and render real data using `@tanstack/react-query`, with client state in Zustand stores. **Do not modify or reference the login page/flow — it is already complete.**

### Page 1 — Command Center (`/dashboard`)

Match the existing layout exactly:
- **KPI cards** (6 total, exactly as in current UI): Active Investigations, Critical Alerts, Suspect Wallets, VASP Matches, Watchlisted Wallets, Cases — all fetched from `GET /dashboard/stats`
- **Risk Distribution** widget: horizontal bars for Critical / High / Medium / Low wallet counts, fetched from `GET /dashboard/charts/risk-distribution`
- **Blockchain Activity** panel: chart of transaction volume/activity per chain, fetched from `GET /dashboard/charts/volume-by-chain`. Must show a real chart once at least one investigation has completed (replace the current "No blockchain data yet" empty state)
- **Live Investigation Feed**: connects to WebSocket `global:activity`, displays real-time entries like "Funds reached known VASP" with relative timestamps ("24m ago"). On mount, hydrate from `GET /dashboard/activity?limit=10`. Entries sourced from mock-fallback pipeline runs should carry a small "(mock)" tag inline
- **Recent Alerts** section (below the fold): latest alerts with severity color, title, relative time, and a "View All" link that navigates to `/dashboard/alerts`. Connects to WebSocket `global:alert` for live updates
- A "LIVE" badge in the top-right must pulse green when the WebSocket connection is active, and turn gray/red if disconnected (this refers to the socket connection status, distinct from the data-source LIVE/MOCK indicator described in Task 1)

### Page 2 — New Investigation (`/dashboard/new-investigation`)

- Step 1 (Case Details): All form fields validated client-side before "Next". NCRP ref number format: `NCRP-YYYY-XXXXXX`. Phone must be valid Indian format.
- Step 2 (Suspect Wallet): Debounce 500ms on input, then call `GET /blockchain-configs/auto-detect?address=<input>`. Display detected chain name/icon or "Unknown format" warning. Manual chain selection dropdown (populated from `GET /blockchain-configs?isActive=true`) as fallback.
- Step 3 (Review & Submit): Show summary. On "Submit", call `POST /investigations`. Loading spinner. On success, redirect to `/dashboard/investigations/[newId]` where the pipeline begins running.

### Page 3 — Investigations (`/dashboard/investigations` list + `/dashboard/investigations/[id]` detail)

**List view:** fetch from `GET /investigations` with filters (status, risk level, date range), paginated table with case ref, suspect wallet (truncated), chain, status badge, risk badge, created date, link to detail.

**Detail view:**
- On mount, fetch `GET /investigations/:id`
- Connect to WebSocket room `investigation:{id}`
- **Left sidebar (40%):** vertical stepper of 14 stages (checkmark/spinner/clock/X per status, duration from timestamps, status message), overall circular progress %, key metric cards (Detected Chain **with LIVE/MOCK data-source badge**, Transaction Count, Unique Addresses, Risk Score with color, Risk Level badge)
- **Right section (60%):** Live Alert Feed (listens for `investigation:alert`, including fallback-to-mock notices), Counterparties table (top addresses by volume, with Entity Label and Risk Flag), Action buttons: "View Full Graph" (→ `/dashboard/graph?investigation={id}`), "Generate Report" (`GET /investigations/:id/report`), "Download PDF" (`GET /investigations/:id/report/pdf`), "Generate Section 91 Notice" (`POST /investigations/:id/generate-notice`)

### Page 4 — Transaction Graph (`/dashboard/graph`)

- Accept query param `?investigation={id}`
- Fetch graph JSON from the investigation record (or `GET /wallets/:suspectWalletId/graph`)
- Render using React Flow with custom node components per type:
  - SUSPECT: red octagon + warning icon
  - EXCHANGE: green rectangle + bank icon
  - MIXER: purple diamond + shuffle icon
  - BRIDGE: blue hexagon + link icon
  - DEX: orange rounded rectangle + swap icon
  - INTERMEDIARY: yellow circle
  - UNKNOWN: gray circle
- Nodes show truncated address, entity label, risk-level dot
- Edges show amount + token, arrow direction, color by type (green transfer, orange swap, blue bridge, red mixer)
- Toolbar: zoom in/out, fit view, filter by node type, color-by selector (risk/entity/blockchain), export as PNG, **and a persistent data-source banner/badge (LIVE / MOCK / MIXED) reflecting the investigation's dataSourceMeta**
- Minimap bottom-right
- Click node → detail panel (address, entity label, total received/sent, risk score, link to Wallet Intelligence page)
- Click edge → tooltip with tx hash, amount, timestamp, block number, link to block explorer

### Page 5 — VASP Intelligence (`/dashboard/vasp`)

- Fetch from `GET /vasps` with filters
- Card grid (3 cols desktop, 1 mobile): VASP name, jurisdiction with flag emoji, supported blockchains as icons, KYC badge, confidence progress bar, verification badge
- Click card → expand/navigate to detail with nodal officer contact, known wallet addresses table, attribution history (investigations where attributed)
- Admin users see "Add VASP" / "Edit" buttons

### Page 6 — Wallet Intelligence (`/dashboard/wallets` list + `/dashboard/wallets/[address]` detail)

**List view:** searchable/filterable table of known wallets with address, chain, risk badge, entity label, last activity.

**Detail view:**
- Fetch `GET /wallets?address={address}` then `GET /wallets/:id`; if not present, create on-the-fly
- **Left panel (35%):** metadata (total received/sent, balance, first/last seen, tx count), large circular risk gauge (0-100, color gradient), risk level badge, expandable risk factors list, detected fraud pattern badges
- **Right panel (65%):** transaction history from `GET /wallets/:id/transactions` — Date, From, To, Amount, Token, USD Value, Type badge, Risk Flag, **Data Source badge (LIVE/MOCK) per row**; sortable, paginated (20/page), row expands to full tx hash linked to block explorer

### Page 7 — Fraud Campaigns (`/dashboard/fraud-campaigns`)

New functional page grouping related investigations (linked via Stage 13 case correlation or shared fraud typology, e.g. same scam category or same attributed VASP):
- Fetch from `GET /fraud-campaigns` (create this endpoint — groups investigations by shared VASP endpoint, shared wallet, or same `fraudCategory` field)
- Card/list view: Campaign name (derived from common fraud type, e.g. "FxProMax Investment Scam Network"), number of linked cases, total traced volume, common VASP/exchange, risk level, list of linked investigation IDs with links
- Click a campaign → expanded view showing all linked investigations, a combined mini-graph (merged nodes/edges across cases), and shared entity list
- Empty state: if no correlations exist yet, show a friendly message ("No fraud campaigns detected yet — campaigns are automatically created when investigations share wallets or VASP endpoints")

### Page 8 — Cross-Chain Monitor (`/dashboard/cross-chain`)

- Fetch from `GET /cross-chain-transfers?investigationId={id}`
- Visual flow diagram: Source Chain icon → Bridge name/logo → Destination Chain icon, with amount/addresses below each
- Table: Source Chain, Source Address, Bridge, Destination Chain, Destination Address, Amount, Confidence, Status, **Data Source (LIVE/MOCK)**
- For demo, show the pre-seeded THORChain bridge from Ethereum to TRON

### Page 9 — Alert Center (`/dashboard/alerts`, linked from Command Center)

- Fetch from `GET /alerts` with filters for severity and status
- Table: Severity (color icon), Title, Message (truncated), Investigation link, Timestamp (relative), Status badge, Actions (Acknowledge, Archive)
- Click row → expand full alert details
- Bulk actions: select multiple → Mark Read, Acknowledge
- Real-time: new alerts appear at top via WebSocket (`global:alert`), including live-to-mock fallback notices

### Page 10 — Watchlist (`/dashboard/watchlist`)

- Fetch from `GET /watchlist`
- Table: Address, Blockchain, Added Date, Last Activity, Sensitivity Level badge, Risk Score, Actions (Remove, View Details)
- "Add to Watchlist" button → form: address input with auto-detect, sensitivity level selector (CRITICAL/HIGH/MEDIUM/LOW), notes textarea
- On submit, calls `POST /wallets/:id/add-to-watchlist`

### Page 11 — Reports (`/dashboard/reports`)

- Fetch from `GET /reports`
- Table: Report Name, Investigation link, Status badge (DRAFT/REVIEWED/APPROVED/SUBMITTED), Created By, Date, Actions
- "View" → formatted read-only report view: Executive Summary, Case Details, Suspect Wallet Analysis, Fund Flow Trace (mini graph or path list), VASP Attributions, Risk Assessment, Detected Patterns, Recommendations, **Data Provenance (which chains/stages used LIVE APIs vs MOCK fallback)**, Evidence Integrity (SHA-256 hash, timestamp, investigator signature)
- "Download PDF" → generate PDF from report content (HTML-to-PDF, browser print, `jspdf`, or server-side `puppeteer` if available)
- "Download JSON" → raw JSON export
- SERVEABLE attributions show a "Generate Section 91 Notice" button opening a pre-filled notice template with suspect wallet, VASP name, nodal officer details, estimated freeze amount, transaction evidence summary, 72-hour deadline

### Page 12 — Blockchain Explorer (`/dashboard/explorer`)

- Large centered search bar with tabs: Wallet Address | Transaction Hash | Case Number
- Wallet address → redirect to `/dashboard/wallets/[address]`
- Transaction hash → `GET /transactions?hash={hash}`, display result card (from, to, amount, token, block, timestamp, block explorer link, data source badge)
- Case number → `GET /cases?ncrpRef={number}`, display case summary with link to investigation detail

### Page 13 — Settings (`/dashboard/settings`)

- Tab "Profile": user's own profile info, editable name/contact, change-password form
- Tab "Notifications": toggle preferences for alert severity levels that trigger in-app/toast notifications
- Tab "System Health": 4 status cards (API Server, Database, Graph DB, Queue), fetched from `GET /health`; Blockchain RPC Provider Status table from `GET /health/blockchain-providers` showing per-chain LIVE/MOCK status and latency, with a "Test All" button; auto-refresh every 30 seconds

### Page 14 — Administration (`/dashboard/admin`)

- **Tab 1 (Users):** `GET /admin/users`. Table: Name, Email, Role badge, Organization, Status, Actions. "Invite User" opens form. Edit opens modal with role selector, org selector, active toggle.
- **Tab 2 (Organizations):** `GET /admin/organizations`. Similar CRUD table.
- **Tab 3 (Blockchain Providers):** the Dynamic API Registry UI from Task 1 — the centerpiece feature, including the LIVE/MOCK status indicators.
- **Tab 4 (Audit Logs):** `GET /admin/audit-logs`. Read-only table: Timestamp, Actor, Action Type, Affected Entity, IP Address, Status, expandable Details. Filters for date range, action type, actor. Export to CSV. Log entries for provider fallback events (live→mock) must also appear here.

---

## TASK 4: Backend Endpoints That Need to Be Created or Completed

**Dashboard Stats & Charts:**
- `GET /dashboard/stats` — returns: `activeInvestigations`, `criticalAlerts`, `suspectWallets`, `vaspMatches`, `watchlistedWallets`, `cases` (exact fields matching the Command Center KPI cards)
- `GET /dashboard/activity?limit=N` — recent system events for Live Investigation Feed
- `GET /dashboard/charts/volume-by-chain` — transaction volume grouped by blockchain (Blockchain Activity panel)
- `GET /dashboard/charts/risk-distribution` — wallet count grouped by risk level (Critical/High/Medium/Low)
- `GET /dashboard/charts/investigation-status` — investigation count grouped by status
- `GET /dashboard/charts/attribution-trend` — daily attribution success rate, last 30 days

**Fraud Campaigns:**
- `GET /fraud-campaigns` — groups investigations sharing a VASP endpoint, wallet address, or fraud category into campaign objects

**Cross-Chain:**
- `GET /cross-chain-transfers` — query params: `investigationId`, `page`, `limit`

**Watchlist:**
- `GET /watchlist` — all wallets where `isOnWatchlist = true`, paginated
- (Wallet add/remove from watchlist endpoints should already exist per the entity spec)

**Health:**
- `GET /health` — subsystem status object with latencies and connection states
- `GET /health/blockchain-providers` — status of each active blockchain config's RPC endpoint, **including which are currently resolving LIVE vs MOCK**

**Transaction Search:**
- `GET /transactions?hash={hash}` — search by transaction hash across all normalized transactions

**Reports:**
- `GET /investigations/:id/report/pdf` — generate and return PDF of the forensic report. Must include: title page with ChainSentinel logo and investigation ID, executive summary, case details, fund flow path listing, VASP attribution table, risk score breakdown, detected patterns, recommendations, **data provenance statement (LIVE/MOCK per chain)**, SHA-256 integrity hash at the bottom of the last page, investigator name + timestamp as digital signature.

**Notice Generation:**
- `POST /investigations/:id/generate-notice` — body: `{ vaspId, noticeType }`. Returns a pre-filled Section 91 CrPC notice as JSON (and optionally HTML) with: addressed to VASP nodal officer, re: investigation number and NCRP case number, suspect wallet address, estimated amount for freezing, list of supporting transaction hashes, request for account details/transaction records, 72-hour compliance deadline.

---

## TASK 5: WebSocket Real-Time Events

Set up a NestJS WebSocket gateway supporting room-based event streaming.

**Rooms:**
- `investigation:{investigationId}` — pipeline events for one investigation
- `global:activity` — Command Center activity feed
- `global:alert` — Command Center / Alert Center new alerts

**Events to Emit:**

From the pipeline orchestrator:
- `investigation:stage-update` → `{ investigationId, stage, progressPercentage, message, timestamp, dataSource }`
- `investigation:alert` → `{ investigationId, severity, title, message, walletAddress, timestamp }` (used also for live→mock fallback notices)
- `investigation:completed` → `{ investigationId, riskScore, riskLevel, topVasp, confidence, recommendation, dataSource, timestamp }`
- `investigation:failed` → `{ investigationId, failureStage, errorMessage, timestamp }`

From alert creation:
- `global:alert` → `{ alertId, severity, title, message, investigationId, timestamp }`

From any significant action:
- `global:activity` → `{ actorName, actionType, entityType, entityId, message, timestamp }`

**Frontend Connection:**
- On `/dashboard` (Command Center): connect to `global:activity` and `global:alert`
- On `/dashboard/investigations/[id]`: connect to `investigation:{id}`
- On `/dashboard/alerts`: connect to `global:alert`
- Use Socket.IO client via a custom hook (`useSocket`) or Zustand store

---

## TASK 6: Demo Flow Script — Ensure This Exact Walkthrough Works

Assume the user is **already authenticated** (login flow is complete and out of scope). The demo starts at the Command Center.

1. **Command Center loads** (`/dashboard`) with KPI cards showing non-zero data from the pre-seeded case, Risk Distribution bars populated, Blockchain Activity chart rendered, Live Investigation Feed showing recent events, Recent Alerts populated
2. **Click "New Investigation"** in sidebar → wizard opens
3. **Fill Step 1:** NCRP-2026-000483, "Priya Sharma", +91-9876-543211, "Investment Scam", "Victim lost 25,000 USDT to fake crypto trading platform FxProMax", 25000, USDT
4. **Fill Step 2:** Paste a **real, currently active Ethereum wallet address** (or the seeded secondary demo address if offline) → auto-detect shows "Ethereum Mainnet ✅" → Next
5. **Step 3:** Review summary → click "Submit Investigation"
6. **Redirect to Investigations detail page** → pipeline begins → stages update in real-time (checkmarks appearing, spinner on current stage, progress bar filling). If the address is real, Stage 3/4 should show a "LIVE" badge as the Etherscan API is called live with the real key.
7. **Within 30-60 seconds** (demo speed), pipeline completes all 14 stages
8. **Investigation Detail shows:** Risk Score, detected patterns, VASP attribution (if resolvable from real data) or graceful fallback with MOCK badge if the real address has no traceable illicit pattern
9. **Click "View Full Graph"** → Transaction Graph loads with nodes colored by type, edges showing fund flow, data-source banner visible
10. **Click the exchange node** (if attributed) → detail panel shows exchange name, total deposited amount, confidence
11. **Navigate back to Investigation Detail** → Click "Generate Report" → report appears
12. **View Report** (`/dashboard/reports`) → formatted investigation summary with all sections, data provenance section, SHA-256 hash at bottom
13. **Click "Generate Section 91 Notice"** → notice template appears with VASP details pre-filled (only shown/enabled if a SERVEABLE attribution exists)
14. **Navigate to Administration → Blockchain Providers tab** → shows list of 6 pre-configured chains, each showing LIVE status where a key is present
15. **Click "Add Blockchain"** → select "Ethereum-like" template → fill: "Fantom Opera", Chain ID 250, FTM, paste a real Ftmscan API key/URL → Test Connection → green "LIVE" checkmark → Save & Activate → Fantom appears in the table as LIVE
16. **Navigate back to Command Center** → KPI cards updated with new investigation data
17. **Navigate to Alert Center** (via "View All" from Command Center Recent Alerts) → shows alerts from the completed investigation
18. **Navigate to Fraud Campaigns** → if correlated cases exist, show grouped campaign view

For this flow to work, ensure:
- The pre-seeded primary demo wallet (`0x1234567890abcdef1234567890abcdef12345678`) always deterministically triggers mock data (clearly marked as MOCK) regardless of live key configuration, since it's a fixed offline-safe fallback fixture guaranteed to produce the full 14-hop dramatic demo narrative
- Real wallet addresses submitted through the wizard are traced live using the configured API keys, with graceful, clearly-labeled fallback to mock only if the live call genuinely fails
- The pipeline runs at accelerated demo speed (each stage completes in 2-5 seconds, total pipeline ~45 seconds) whether live or mock
- All pages handle loading states gracefully (skeletons or spinners, not blank screens)
- All pages handle empty states gracefully (meaningful messages, not broken layouts)

---

## TASK 7: Mock Data Provider — Complete, Deterministic, and Clearly Flagged

Create a `MockBlockchainProvider` that implements the same `IBlockchainProvider` interface as real providers but returns pre-built, deterministic data. **This provider is a fallback of last resort, not the default** — the real live providers (using the supplied API keys) must always be attempted first per config.

**Requirements:**
- Activated only when: (a) `USE_MOCK_PROVIDERS=true` is explicitly set (offline demo override), OR (b) a blockchain config has no API key stored, OR (c) all live endpoints (primary + fallbacks) failed after retry/timeout
- Every value returned by this provider must be tagged `dataSource: 'MOCK'` and `providerName: 'Mock Provider'` so it is never confused with live data downstream
- For the primary demo wallet (`0x1234567890abcdef1234567890abcdef12345678`), return exactly the transaction set described in Task 2's demo case (50 ETH flowing through intermediaries, splitting, going through mixer and DEX, bridging to TRON, depositing at WazirX)
- For the secondary demo wallet (`0xabcdef1234567890abcdef1234567890abcdef12`), return a different but equally rich transaction set (25,000 USDT flowing through 4 intermediaries with rapid forwarding, a Uniswap V3 swap, and ending at Binance)
- For any other address (when live lookups genuinely fail and no fixture matches): generate a plausible but minimal set of 5-10 transactions with random intermediaries, leading to one of the pre-configured VASP wallets, to ensure the pipeline always has data to work with
- All mock data must have consistent timestamps (within the last 30 days), realistic amounts, proper token symbols, and valid-looking (but fake) transaction hashes
- Log every mock-provider activation (with reason: no-key / live-failure / forced-override) to the audit log so there is a traceable record of when and why the system used mock data instead of the real APIs

---

## TASK 8: Presentation Slide Update

The last slide of the presentation needs to be updated. Generate content for a final slide titled **"Impact & Future Roadmap"** with two sections:

**Demonstrated Capabilities (MVP):**
- Dynamic multi-chain blockchain API integration (add any chain via UI) with live-first data resolution and transparent mock-fallback indicators
- Real-time 14-stage automated investigation pipeline
- Explainable risk scoring with court-defensible factor breakdown
- VASP attribution with confidence-ranked exchange identification
- Cross-chain bridge tracking (THORChain, Stargate, LayerZero)
- Court-ready forensic reports with SHA-256 integrity hashing and data provenance disclosure
- Section 91 CrPC notice auto-generation
- 6-role RBAC with immutable audit logging

**Future Roadmap (Post-Hackathon):**
- Direct NCRP / 1930 Helpline API integration for automated case ingestion
- SAHYOG platform bidirectional integration
- ML-based pattern detection (GNN for transaction graph anomaly detection)
- Automated VASP nodal officer notification system
- Mobile companion app for field investigators
- Scalable PostgreSQL + distributed Redis deployment for 10,000+ cases/day
- Interpol / international LEA coordination module
- Privacy-preserving analytics (zero-knowledge proofs for cross-agency data sharing)

---

## Critical Constraints

1. **No hardcoded blockchain logic.** Every chain interaction must flow through the dynamic blockchain config from the database. The entire point of the Dynamic API Registry feature is that adding a new blockchain is a UI operation, not a code operation.

2. **Real API keys are available and must be used as the default data source.** The system must attempt live API calls first for every configured chain that has a key. Mock data is an emergency fallback only — triggered by missing keys or genuine live-call failure — never a lazy default. This is a hard requirement, not optional behavior.

3. **Every use of mock data anywhere in the system must be visibly and unambiguously flagged in the UI** (badges on Investigation Detail, Transaction Graph, Wallet Intelligence, Reports, Blockchain Providers table, and System Health), and the underlying `dataSource` field must be present in the relevant API responses so the frontend renders it accurately rather than assuming.

4. **SQLite for demo.** Do not require PostgreSQL, Redis, or Neo4j for the demo to function. All must have in-memory or SQLite fallbacks. The system should start with `pnpm dev` and work immediately, picking up API keys from environment variables automatically.

5. **Every page must show data.** No blank pages, no "coming soon" placeholders. Every page in the sidebar (Command Center, Investigations, New Investigation, Transaction Graph, VASP Intelligence, Wallet Intelligence, Fraud Campaigns, Cross-Chain Monitor, Watchlist, Reports, Administration, Settings, Blockchain Explorer) must render meaningful content — either from live-traced data, pre-seeded data, or a recently completed investigation.

6. **WebSocket events must fire.** The investigation detail page must show live progress, including transparent fallback notices when live calls fail mid-pipeline. This is the single most impressive demo moment and must work flawlessly.

7. **The graph must be visually impressive.** The React Flow graph on Transaction Graph page with custom colored nodes and directed edges is the second most impressive demo moment. It must render correctly with real or demo data showing a clear fund flow from suspect wallet through intermediaries to exchange.

8. **Report generation must work end-to-end.** Clicking "Generate Report" must produce a viewable, downloadable document (even if it's just well-formatted HTML/JSON), including the data provenance section. The SHA-256 hash must be real and verifiable.

9. **Section 91 notice must be pre-filled.** The legal notice template must contain actual data from the investigation — not lorem ipsum.

10. **Error handling must be graceful.** No unhandled promise rejections, no white screens of death, no cryptic error messages. Every live-API failure must trigger a clean, labeled fallback to mock — never a broken page.

11. **Audit logging must capture every action** — investigation creation, report generation, blockchain config changes, watchlist modifications, and every live→mock fallback event — with actor, timestamp, IP, and action details.

12. **Do not touch authentication/login.** The login page, JWT flow, and auth store are already complete and out of scope for this sprint. Do not regenerate, refactor, or reference them in any implementation plan.


# Small Update — Single-Role Demo Constraint

**Addition to the ChainSentinel AI sprint prompt:**

For this demo, **only the Admin role will be used** — do not build, gate, or test against any other role (Investigator, Supervisor, Analyst, etc.) for now. Specifically:

1. **RBAC checks:** Every page and every API endpoint used in this sprint (Command Center, Investigations, New Investigation, Transaction Graph, VASP Intelligence, Wallet Intelligence, Fraud Campaigns, Cross-Chain Monitor, Watchlist, Reports, Administration, Settings, Blockchain Explorer) must be fully accessible and functional for the **Admin** role. Do not restrict any feature behind a non-admin role check.

2. **Remove role-conditional UI branches for this sprint.** Anywhere the original spec says things like *"Admin users see 'Add VASP' and 'Edit' buttons"* — just always show these, since the only account in use is Admin. Do not build separate views/permissions for Investigator/Supervisor/etc.

3. **Administration page is fully usable by Admin** — Users tab, Organizations tab, Blockchain Providers tab, Audit Logs tab all work under the Admin account with no additional role hierarchy needed.

4. **Do not modify the existing role/permission system or seeded accounts** — just ensure that for every feature built in this sprint, the Admin role has full unrestricted access, and skip any work related to per-role UI variation, other role dashboards, or role-based feature toggling.

5. **Pipeline execution, blockchain config CRUD, report generation, notice generation, watchlist actions** — all triggered/tested only as the Admin user. No need to build or verify flows for other roles.

Everything else in the previous full sprint prompt remains unchanged.
















#### Smaller compact prompt of the above 
# ChainSentinel AI — Consolidated Final Sprint Prompt (Compact)

## Context
ChainSentinel AI (SIH 26183) monorepo already has: DB entities, auth/login (fully working — **do not touch**), RBAC, UI shells for all sidebar pages, 14-stage pipeline definition, seed accounts. **Missing:** actual working behavior — data fetching, pipeline execution, blockchain provider resolution, graph rendering, report generation.

**Role constraint:** Build and test everything using **Admin role only**. No other role gating, no role-conditional UI branches — Admin sees/does everything (e.g. "Add VASP", all Admin tabs, all actions).

**UI routes (already scaffolded, use exactly):**
`/dashboard` (Command Center), `/dashboard/investigations[/[id]]`, `/dashboard/new-investigation`, `/dashboard/graph`, `/dashboard/vasp`, `/dashboard/wallets[/[address]]`, `/dashboard/fraud-campaigns`, `/dashboard/cross-chain`, `/dashboard/watchlist`, `/dashboard/reports`, `/dashboard/admin` (tabs: Users, Organizations, Blockchain Providers, Audit Logs), `/dashboard/settings` (tabs: Profile, Notifications, System Health), `/dashboard/explorer`, `/dashboard/alerts`.

---

## Core Build Tasks

**1. Dynamic Blockchain Provider Registry (Admin → Blockchain Providers tab)**
Full CRUD (`GET/POST/PUT/DELETE /blockchain-configs`), `test-connection` endpoint, `auto-detect?address=` endpoint. `BlockchainProviderFactory` resolves provider purely from DB config — no hardcoded chain logic. Multi-step Add/Edit form (template select → basic info → API config w/ fallbacks → address regex validation → VASP wallets → bridges → DEX routers → review+test+save). Seed 6 chains (Ethereum, TRON, Bitcoin, Polygon, BNB, Solana) with real API keys pulled from env vars (`ETHERSCAN_API_KEY`, `TRONGRID_API_KEY`, `POLYGONSCAN_API_KEY`, `BSCSCAN_API_KEY`, `HELIUS_API_KEY`) where available.

**Live-first rule:** Real API keys ARE available and must be used as the **default/primary** data source — always attempt live call first (primary → fallbacks) per config. Drop to `MockBlockchainProvider` **only** if: no key stored, all live endpoints fail after retry, or `USE_MOCK_PROVIDERS=true` is explicitly forced (default `false`).

**Mandatory transparency rule:** Every data-fetching response must carry `dataSource: 'LIVE' | 'MOCK'` + `providerName` + `latencyMs`, persisted on investigation/transaction/report records — never silently swap mock for live. Render this everywhere mock could appear:
- Investigation Detail (next to Detected Chain)
- Transaction Graph (toolbar banner)
- Wallet Intelligence (next to tx history)
- Reports (Evidence Integrity / Data Provenance section)
- Admin → Blockchain Providers table (Status column)
- Settings → System Health / `GET /health/blockchain-providers`
If a live call fails mid-pipeline and falls back, emit a WebSocket `investigation:alert` explaining the fallback (e.g. "Live Etherscan API unavailable — falling back to mock").

**2. Pipeline Orchestrator — execute all 14 stages** (address validation → chain detection → tx ingestion → normalization → graph build → fund-flow trace → entity matching → cross-chain analysis → pattern analysis → risk scoring → VASP attribution → case correlation → recommendation/report generation), each stage live-first per Task 1's rule, updating `investigations` table + emitting `investigation:stage-update` WebSocket events per stage. Retries 3x then `FAILED`. Fixed demo fixture wallet `0x1234567890abcdef1234567890abcdef12345678` always deterministically resolves via MOCK (clearly tagged) producing: 4 hops, rapid forwarding, fan-out, mixer path, Uniswap swap path, THORChain bridge to TRON, WazirX deposit, risk score 78 CRITICAL, WazirX attribution 0.95 SERVEABLE. Real addresses submitted via the wizard should attempt live tracing using configured keys, gracefully falling back (labeled) only on genuine failure.

**3. Wire every frontend page to real backend data** via React Query — Command Center KPIs/charts/activity feed, New Investigation wizard (auto-detect, submit), Investigations list+detail (stepper, live WS updates, counterparties, actions), Transaction Graph (React Flow, typed/colored nodes+edges, data-source banner), VASP Intelligence, Wallet Intelligence (risk gauge, tx history w/ data-source badges), Fraud Campaigns (grouped by correlation), Cross-Chain Monitor, Alert Center, Watchlist, Reports (view/PDF/JSON/Section 91 notice), Blockchain Explorer, Settings (System Health w/ LIVE/MOCK per chain), Administration (all 4 tabs). No blank/placeholder pages — always meaningful pre-seeded or live data.

**4. Missing backend endpoints to build:** `/dashboard/stats`, `/dashboard/activity`, `/dashboard/charts/*`, `/fraud-campaigns`, `/cross-chain-transfers`, `/watchlist`, `/health`, `/health/blockchain-providers`, `/transactions?hash=`, `/investigations/:id/report/pdf`, `/investigations/:id/generate-notice`.

**5. WebSocket gateway** with rooms `investigation:{id}`, `global:activity`, `global:alert`, emitting stage updates, alerts (incl. live→mock fallback notices), completion, and failure events.

**6. Mock provider** — deterministic, clearly tagged `dataSource: MOCK`, fixed fixtures for the two demo wallets, plausible generated data for any other address as last resort. Log every mock activation (reason: no-key / live-failure / forced) to audit log.

---

## Critical Constraints
1. No hardcoded blockchain logic — everything DB-driven.
2. **Live API keys are available and must be the default/primary path** — mock is emergency fallback only, never default.
3. Every mock usage must be visibly flagged in UI (badges) and present as `dataSource` in API responses.
4. SQLite + in-memory fallbacks only — must run via `pnpm dev` with no external DB/Redis/Neo4j dependency.
5. Every sidebar page must always show meaningful data — no blank/"coming soon" states.
6. WebSocket live pipeline progress must work flawlessly (top demo moment).
7. Transaction Graph must render visually rich, correctly colored/typed nodes & edges (2nd top demo moment).
8. Report generation must produce a real, downloadable doc with a real verifiable SHA-256 hash and data provenance section.
9. Section 91 notice must be pre-filled with real investigation/VASP data, not placeholder text.
10. Graceful error handling everywhere — no white screens, no unhandled rejections; every live-API failure cleanly falls back to labeled mock.
11. Audit log every action: investigation creation, report/notice generation, config changes, watchlist edits, and every live→mock fallback.
12. **Admin role only** — no role gating/branching for other roles anywhere in this sprint's work.
13. **Do not touch, rebuild, or reference the login/auth flow** — it is complete and out of scope.