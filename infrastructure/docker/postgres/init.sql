-- ChainSentinel AI - Database Initialization
-- This runs on first container start

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'SUPER_ADMIN', 'AGENCY_ADMIN', 'SUPERVISOR', 
        'INVESTIGATOR', 'BLOCKCHAIN_ANALYST', 'AUDITOR'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_status AS ENUM (
        'DRAFT', 'ACTIVE', 'MONITORING', 'UNDER_REVIEW', 
        'ESCALATED', 'CLOSED', 'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE investigation_status AS ENUM (
        'QUEUED', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE investigation_stage AS ENUM (
        'INVESTIGATION_REQUESTED', 'ADDRESS_VALIDATION', 'CHAIN_DETECTION',
        'TRANSACTION_INGESTION', 'TRANSACTION_NORMALIZATION', 'GRAPH_BUILD',
        'FUND_FLOW_TRACE', 'ENTITY_MATCHING', 'CROSS_CHAIN_ANALYSIS',
        'PATTERN_ANALYSIS', 'RISK_SCORING', 'VASP_ATTRIBUTION',
        'CASE_CORRELATION', 'RECOMMENDATION_GENERATION', 'INVESTIGATION_COMPLETED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM (
        'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM (
        'UNREAD', 'READ', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fraud_type AS ENUM (
        'INVESTMENT_SCAM', 'TASK_FRAUD', 'RANSOMWARE', 'PHISHING',
        'SEXTORTION', 'DARKNET', 'IMPERSONATION', 'ORGANIZED_FINANCIAL_CRIME', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE watchlist_sensitivity AS ENUM (
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM (
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blockchain_type AS ENUM (
        'ETHEREUM', 'BITCOIN', 'TRON', 'POLYGON', 'BNB_CHAIN', 'SOLANA',
        'ARBITRUM', 'OPTIMISM', 'UNKNOWN'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
