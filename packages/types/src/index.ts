// ============================================================
// ChainSentinel AI - Core Type Definitions
// ============================================================

// ---- Enums ----

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  AGENCY_ADMIN = 'AGENCY_ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  INVESTIGATOR = 'INVESTIGATOR',
  BLOCKCHAIN_ANALYST = 'BLOCKCHAIN_ANALYST',
  AUDITOR = 'AUDITOR',
}

export enum CaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  MONITORING = 'MONITORING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ESCALATED = 'ESCALATED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum InvestigationStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum InvestigationStage {
  INVESTIGATION_REQUESTED = 'INVESTIGATION_REQUESTED',
  ADDRESS_VALIDATION = 'ADDRESS_VALIDATION',
  CHAIN_DETECTION = 'CHAIN_DETECTION',
  TRANSACTION_INGESTION = 'TRANSACTION_INGESTION',
  TRANSACTION_NORMALIZATION = 'TRANSACTION_NORMALIZATION',
  GRAPH_BUILD = 'GRAPH_BUILD',
  FUND_FLOW_TRACE = 'FUND_FLOW_TRACE',
  ENTITY_MATCHING = 'ENTITY_MATCHING',
  CROSS_CHAIN_ANALYSIS = 'CROSS_CHAIN_ANALYSIS',
  PATTERN_ANALYSIS = 'PATTERN_ANALYSIS',
  RISK_SCORING = 'RISK_SCORING',
  VASP_ATTRIBUTION = 'VASP_ATTRIBUTION',
  CASE_CORRELATION = 'CASE_CORRELATION',
  RECOMMENDATION_GENERATION = 'RECOMMENDATION_GENERATION',
  INVESTIGATION_COMPLETED = 'INVESTIGATION_COMPLETED',
}

export enum AlertSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
}

export enum FraudType {
  INVESTMENT_SCAM = 'INVESTMENT_SCAM',
  TASK_FRAUD = 'TASK_FRAUD',
  RANSOMWARE = 'RANSOMWARE',
  PHISHING = 'PHISHING',
  SEXTORTION = 'SEXTORTION',
  DARKNET = 'DARKNET',
  IMPERSONATION = 'IMPERSONATION',
  ORGANIZED_FINANCIAL_CRIME = 'ORGANIZED_FINANCIAL_CRIME',
  OTHER = 'OTHER',
}

export enum WatchlistSensitivity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum BlockchainType {
  ETHEREUM = 'ETHEREUM',
  BITCOIN = 'BITCOIN',
  TRON = 'TRON',
  POLYGON = 'POLYGON',
  BNB_CHAIN = 'BNB_CHAIN',
  SOLANA = 'SOLANA',
  ARBITRUM = 'ARBITRUM',
  OPTIMISM = 'OPTIMISM',
  UNKNOWN = 'UNKNOWN',
}

export enum TransactionStatus {
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  FAILED = 'failed',
}

// ---- User & Auth ----

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// ---- Case & Complaint ----

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  fraudType: FraudType;
  description: string | null;
  complaintId: string | null;
  assignedInvestigatorId: string | null;
  supervisorId: string | null;
  organizationId: string;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Complaint {
  id: string;
  caseId: string;
  complaintNumber: string;
  victimReference: string | null;
  suspectWalletAddress: string;
  blockchain: BlockchainType;
  cryptocurrency: string;
  estimatedFraudAmount: string | null;
  reportedTimestamp: string;
  description: string | null;
  createdAt: string;
}

// ---- Wallet & Blockchain ----

export interface Wallet {
  id: string;
  address: string;
  blockchain: BlockchainType;
  label: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  entityLabel: string | null;
  vaspId: string | null;
  isOnWatchlist: boolean;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedTransaction {
  id: string;
  chain: BlockchainType;
  txHash: string;
  blockNumber: number | string;
  timestamp: string;
  from: string;
  to: string | null;
  asset: string;
  tokenContract: string | null;
  amountRaw: string;
  amountNormalized: string;
  fiatValueAtTime: number | null;
  status: TransactionStatus;
  transactionType: string;
  createdAt: string;
}

export interface Balance {
  asset: string;
  amount: string;
  contractAddress: string | null;
  symbol: string;
  decimals: number;
}

export interface Transaction {
  txHash: string;
  blockNumber: number | string;
  timestamp: number;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  status: TransactionStatus;
  chain: BlockchainType;
  asset: string;
  tokenContract: string | null;
  method: string | null;
}

export interface TokenTransfer {
  txHash: string;
  from: string;
  to: string;
  value: string;
  tokenContract: string;
  tokenSymbol: string;
  tokenDecimals: number;
  blockNumber: number | string;
  timestamp: number;
  chain: BlockchainType;
}

export interface Block {
  number: number | string;
  hash: string;
  timestamp: number;
  miner: string;
  transactionCount: number;
  chain: BlockchainType;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  startBlock?: number;
  endBlock?: number;
  startDate?: string;
  endDate?: string;
}

// ---- Investigation ----

export interface Investigation {
  id: string;
  caseId: string;
  status: InvestigationStatus;
  currentStage: InvestigationStage;
  progress: number;
  message: string | null;
  suspectWallet: string;
  blockchain: BlockchainType | null;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  stats: InvestigationStats | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationStats {
  transactions: number;
  wallets: number;
  bridges: number;
  vaspMatches: number;
  riskScore: number;
  crossChainTransfers: number;
}

export interface InvestigationJob {
  id: string;
  investigationId: string;
  stage: InvestigationStage;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ---- Graph ----

export interface GraphNode {
  id: string;
  type: 'victim' | 'suspect' | 'wallet' | 'burner' | 'exchange' | 'vasp' | 'dex' | 'bridge' | 'mixer' | 'contract' | 'high_risk' | 'unknown';
  label: string;
  address?: string;
  blockchain?: BlockchainType;
  riskScore?: number;
  riskLevel?: RiskLevel;
  entityLabel?: string;
  balance?: string;
  totalReceived?: string;
  totalSent?: string;
  firstSeen?: string;
  lastSeen?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'SENT_TO' | 'RECEIVED_FROM' | 'BRIDGED_TO' | 'SWAPPED_THROUGH' | 'INTERACTED_WITH';
  txHash: string;
  amount: string;
  asset: string;
  timestamp: string;
  blockchain: BlockchainType;
  fiatEquivalent: number | null;
  blockNumber: number | string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---- VASP & Attribution ----

export interface VASP {
  id: string;
  name: string;
  type: 'centralized_exchange' | 'decentralized_exchange' | 'bridge' | 'mixer' | 'payment_service' | 'gambling' | 'merchant' | 'protocol' | 'unknown';
  wallets: string[];
  chains: BlockchainType[];
  jurisdiction: string | null;
  source: string;
  confidence: number;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
  firstSeen: string;
  lastUpdated: string;
  metadata: Record<string, unknown>;
}

export interface Attribution {
  id: string;
  walletId: string;
  vaspId: string;
  confidence: number;
  distance: number;
  traceableAmount: string;
  crossChain: boolean;
  path: string[];
  supportingTransactions: string[];
  labelSource: string;
  factors: AttributionFactor[];
  createdAt: string;
}

export interface AttributionFactor {
  factor: string;
  weight: number;
  contribution: number;
}

// ---- Risk ----

export interface RiskAssessment {
  id: string;
  walletId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  fraudPatterns: FraudPattern[];
  assessedAt: string;
}

export interface RiskFactor {
  factor: string;
  score: number;
  weight: number;
  description: string;
}

export interface FraudPattern {
  id: string;
  patternType: string;
  confidence: number;
  riskContribution: number;
  description: string;
  affectedTransactions: string[];
}

// ---- Cross-Chain ----

export interface CrossChainTransfer {
  id: string;
  sourceChain: BlockchainType;
  sourceWallet: string;
  sourceTransaction: string;
  sourceAsset: string;
  bridge: string;
  destinationChain: BlockchainType;
  destinationTransaction: string | null;
  destinationWallet: string | null;
  destinationAsset: string;
  confidence: number;
  amount: string;
  timestamp: string;
}

// ---- Watchlist ----

export interface WatchlistEntry {
  id: string;
  walletAddress: string;
  blockchain: BlockchainType;
  caseId: string | null;
  reason: string;
  sensitivity: WatchlistSensitivity;
  createdBy: string;
  createdAt: string;
  watchConditions: Record<string, unknown>;
  isActive: boolean;
}

// ---- Alerts ----

export interface Alert {
  id: string;
  caseId: string | null;
  walletAddress: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  type: string;
  metadata: Record<string, unknown>;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Reports ----

export interface Report {
  id: string;
  caseId: string;
  title: string;
  generatedBy: string;
  fileUrl: string | null;
  sha256Hash: string | null;
  version: string;
  sections: string[];
  createdAt: string;
}

// ---- Audit ----

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: 'SUCCESS' | 'FAILURE';
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---- API Response Types ----

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---- WebSocket Events ----

export interface WSInvestigationProgress {
  investigationId: string;
  stage: InvestigationStage;
  progress: number;
  message: string;
  stats?: InvestigationStats;
}

export interface WSAlert {
  alertId: string;
  caseId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  walletAddress?: string;
}

export interface WSGraphUpdate {
  caseId: string;
  newNode?: GraphNode;
  newEdge?: GraphEdge;
}

// ---- Blockchain Adapter ----

export interface BlockchainAdapter {
  chain: BlockchainType;
  validateAddress(address: string): Promise<boolean>;
  getBalance(address: string): Promise<Balance[]>;
  getTransactions(address: string, options?: QueryOptions): Promise<Transaction[]>;
  getTokenTransfers(address: string): Promise<TokenTransfer[]>;
  getTransaction(txHash: string): Promise<Transaction | null>;
  getBlock(blockIdentifier: string | number): Promise<Block>;
  detectChain(address: string): Promise<BlockchainType | null>;
}

// ---- Job Types ----

export interface InvestigationJobData {
  investigationId: string;
  caseId: string;
  suspectWallet: string;
  blockchain?: BlockchainType;
  fraudType: FraudType;
  estimatedAmount?: string;
}

export interface TracingOptions {
  maxHops: number;
  minAmount: string;
  startDate?: string;
  endDate?: string;
  chain?: BlockchainType;
  token?: string;
  pathCount: number;
  confidenceThreshold: number;
}

export interface TracePath {
  nodes: string[];
  edges: string[];
  totalAmount: string;
  asset: string;
  chain: BlockchainType;
  hopCount: number;
}

// ---- Search ----

export interface SearchQuery {
  query: string;
  type?: 'wallet' | 'transaction' | 'case' | 'complaint' | 'vasp' | 'entity' | 'campaign' | 'cluster';
  limit?: number;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
  metadata?: Record<string, unknown>;
}

// ---- Wallet Clustering ----

export interface WalletCluster {
  id: string;
  wallets: string[];
  confidence: 'CONFIRMED' | 'HIGH_CONFIDENCE' | 'PROBABLE' | 'POSSIBLE' | 'UNKNOWN';
  reasons: string[];
  chain: BlockchainType;
  createdAt: string;
}

// ---- Fraud Campaign ----

export interface FraudCampaign {
  id: string;
  name: string;
  linkedComplaints: string[];
  totalExposure: string;
  commonWallets: string[];
  commonVasps: string[];
  commonChains: BlockchainType[];
  confidence: number;
  fraudTypology: string;
  createdAt: string;
}

// ---- System Health ----

export interface SystemHealth {
  api: ServiceStatus;
  postgres: ServiceStatus;
  neo4j: ServiceStatus;
  redis: ServiceStatus;
  ethProvider: ServiceStatus;
  tronProvider: ServiceStatus;
  workerQueue: ServiceStatus;
  realtimeGateway: ServiceStatus;
}

export interface ServiceStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latency: number | null;
  lastChecked: string;
  details?: Record<string, unknown>;
}

// ---- Recommendations ----

export interface InvestigationRecommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendations: string[];
}
