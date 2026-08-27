"use strict";
// ============================================================
// ChainSentinel AI - Core Type Definitions
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionStatus = exports.BlockchainType = exports.RiskLevel = exports.WatchlistSensitivity = exports.FraudType = exports.AlertStatus = exports.AlertSeverity = exports.InvestigationStage = exports.InvestigationStatus = exports.CaseStatus = exports.UserRole = void 0;
// ---- Enums ----
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["AGENCY_ADMIN"] = "AGENCY_ADMIN";
    UserRole["SUPERVISOR"] = "SUPERVISOR";
    UserRole["INVESTIGATOR"] = "INVESTIGATOR";
    UserRole["BLOCKCHAIN_ANALYST"] = "BLOCKCHAIN_ANALYST";
    UserRole["AUDITOR"] = "AUDITOR";
})(UserRole || (exports.UserRole = UserRole = {}));
var CaseStatus;
(function (CaseStatus) {
    CaseStatus["DRAFT"] = "DRAFT";
    CaseStatus["ACTIVE"] = "ACTIVE";
    CaseStatus["MONITORING"] = "MONITORING";
    CaseStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    CaseStatus["ESCALATED"] = "ESCALATED";
    CaseStatus["CLOSED"] = "CLOSED";
    CaseStatus["ARCHIVED"] = "ARCHIVED";
})(CaseStatus || (exports.CaseStatus = CaseStatus = {}));
var InvestigationStatus;
(function (InvestigationStatus) {
    InvestigationStatus["QUEUED"] = "QUEUED";
    InvestigationStatus["RUNNING"] = "RUNNING";
    InvestigationStatus["PARTIAL"] = "PARTIAL";
    InvestigationStatus["COMPLETED"] = "COMPLETED";
    InvestigationStatus["FAILED"] = "FAILED";
    InvestigationStatus["CANCELLED"] = "CANCELLED";
})(InvestigationStatus || (exports.InvestigationStatus = InvestigationStatus = {}));
var InvestigationStage;
(function (InvestigationStage) {
    InvestigationStage["INVESTIGATION_REQUESTED"] = "INVESTIGATION_REQUESTED";
    InvestigationStage["ADDRESS_VALIDATION"] = "ADDRESS_VALIDATION";
    InvestigationStage["CHAIN_DETECTION"] = "CHAIN_DETECTION";
    InvestigationStage["TRANSACTION_INGESTION"] = "TRANSACTION_INGESTION";
    InvestigationStage["TRANSACTION_NORMALIZATION"] = "TRANSACTION_NORMALIZATION";
    InvestigationStage["GRAPH_BUILD"] = "GRAPH_BUILD";
    InvestigationStage["FUND_FLOW_TRACE"] = "FUND_FLOW_TRACE";
    InvestigationStage["ENTITY_MATCHING"] = "ENTITY_MATCHING";
    InvestigationStage["CROSS_CHAIN_ANALYSIS"] = "CROSS_CHAIN_ANALYSIS";
    InvestigationStage["PATTERN_ANALYSIS"] = "PATTERN_ANALYSIS";
    InvestigationStage["RISK_SCORING"] = "RISK_SCORING";
    InvestigationStage["VASP_ATTRIBUTION"] = "VASP_ATTRIBUTION";
    InvestigationStage["CASE_CORRELATION"] = "CASE_CORRELATION";
    InvestigationStage["RECOMMENDATION_GENERATION"] = "RECOMMENDATION_GENERATION";
    InvestigationStage["INVESTIGATION_COMPLETED"] = "INVESTIGATION_COMPLETED";
})(InvestigationStage || (exports.InvestigationStage = InvestigationStage = {}));
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["INFO"] = "INFO";
    AlertSeverity["LOW"] = "LOW";
    AlertSeverity["MEDIUM"] = "MEDIUM";
    AlertSeverity["HIGH"] = "HIGH";
    AlertSeverity["CRITICAL"] = "CRITICAL";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["UNREAD"] = "UNREAD";
    AlertStatus["READ"] = "READ";
    AlertStatus["ACKNOWLEDGED"] = "ACKNOWLEDGED";
    AlertStatus["INVESTIGATING"] = "INVESTIGATING";
    AlertStatus["RESOLVED"] = "RESOLVED";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
var FraudType;
(function (FraudType) {
    FraudType["INVESTMENT_SCAM"] = "INVESTMENT_SCAM";
    FraudType["TASK_FRAUD"] = "TASK_FRAUD";
    FraudType["RANSOMWARE"] = "RANSOMWARE";
    FraudType["PHISHING"] = "PHISHING";
    FraudType["SEXTORTION"] = "SEXTORTION";
    FraudType["DARKNET"] = "DARKNET";
    FraudType["IMPERSONATION"] = "IMPERSONATION";
    FraudType["ORGANIZED_FINANCIAL_CRIME"] = "ORGANIZED_FINANCIAL_CRIME";
    FraudType["OTHER"] = "OTHER";
})(FraudType || (exports.FraudType = FraudType = {}));
var WatchlistSensitivity;
(function (WatchlistSensitivity) {
    WatchlistSensitivity["LOW"] = "LOW";
    WatchlistSensitivity["MEDIUM"] = "MEDIUM";
    WatchlistSensitivity["HIGH"] = "HIGH";
    WatchlistSensitivity["CRITICAL"] = "CRITICAL";
})(WatchlistSensitivity || (exports.WatchlistSensitivity = WatchlistSensitivity = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "LOW";
    RiskLevel["MEDIUM"] = "MEDIUM";
    RiskLevel["HIGH"] = "HIGH";
    RiskLevel["CRITICAL"] = "CRITICAL";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var BlockchainType;
(function (BlockchainType) {
    BlockchainType["ETHEREUM"] = "ETHEREUM";
    BlockchainType["BITCOIN"] = "BITCOIN";
    BlockchainType["TRON"] = "TRON";
    BlockchainType["POLYGON"] = "POLYGON";
    BlockchainType["BNB_CHAIN"] = "BNB_CHAIN";
    BlockchainType["SOLANA"] = "SOLANA";
    BlockchainType["ARBITRUM"] = "ARBITRUM";
    BlockchainType["OPTIMISM"] = "OPTIMISM";
    BlockchainType["UNKNOWN"] = "UNKNOWN";
})(BlockchainType || (exports.BlockchainType = BlockchainType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["CONFIRMED"] = "confirmed";
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["FAILED"] = "failed";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
//# sourceMappingURL=index.js.map