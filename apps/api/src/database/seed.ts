import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { Organization } from './entities/organization.entity';
import { Case } from './entities/case.entity';
import { Complaint } from './entities/complaint.entity';
import { Investigation } from './entities/investigation.entity';
import { InvestigationJob } from './entities/investigation-job.entity';
import { Wallet } from './entities/wallet.entity';
import { NormalizedTransaction } from './entities/normalized-transaction.entity';
import { VASP } from './entities/vasp.entity';
import { Alert } from './entities/alert.entity';
import { WatchlistEntry } from './entities/watchlist.entity';
import { RiskAssessment } from './entities/risk-assessment.entity';
import { WalletCluster } from './entities/wallet-cluster.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Report } from './entities/report.entity';
import { CrossChainTransfer } from './entities/cross-chain-transfer.entity';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://chainsentinel:chainsentinel_dev_2026@localhost:5432/chainsentinel',
  entities: [
    User, Organization, Case, Complaint, Investigation, InvestigationJob,
    Session, Wallet, NormalizedTransaction, VASP, Alert, WatchlistEntry, RiskAssessment,
    WalletCluster, AuditLog, Report, CrossChainTransfer,
  ],
  synchronize: true,
  logging: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('Database connected. Seeding...');

  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);
  const caseRepo = dataSource.getRepository(Case);
  const complaintRepo = dataSource.getRepository(Complaint);
  const invRepo = dataSource.getRepository(Investigation);
  const jobRepo = dataSource.getRepository(InvestigationJob);
  const walletRepo = dataSource.getRepository(Wallet);
  const txRepo = dataSource.getRepository(NormalizedTransaction);
  const vaspRepo = dataSource.getRepository(VASP);
  const alertRepo = dataSource.getRepository(Alert);
  const watchlistRepo = dataSource.getRepository(WatchlistEntry);
  const riskRepo = dataSource.getRepository(RiskAssessment);
  const clusterRepo = dataSource.getRepository(WalletCluster);
  const auditRepo = dataSource.getRepository(AuditLog);
  const reportRepo = dataSource.getRepository(Report);
  const crossChainRepo = dataSource.getRepository(CrossChainTransfer);

  // Idempotent: skip if already seeded
  const existingUsers = await userRepo.count();
  if (existingUsers > 0) {
    console.log('Database already seeded. Skipping...');
    await dataSource.destroy();
    return;
  }

  // Create organization
  const org = orgRepo.create({
    name: 'Cyber Crime Investigation Unit',
    code: 'CCIU',
    isActive: true,
    settings: { theme: 'dark', notifications: true },
  });
  await orgRepo.save(org);
  console.log(`Organization created: ${org.id}`);

  // Create users - password from env or default for dev only
  const seedPassword = process.env.SEED_PASSWORD || process.env.DEFAULT_PASSWORD || 'ChangeMeImmediately!';
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const admin = userRepo.create({
    email: 'admin@chainsentinel.gov.in',
    firstName: 'System',
    lastName: 'Admin',
    passwordHash,
    role: 'SUPER_ADMIN' as any,
    organizationId: org.id,
    isActive: true,
  });
  await userRepo.save(admin);

  const supervisor = userRepo.create({
    email: 'supervisor@chainsentinel.gov.in',
    firstName: 'Rajesh',
    lastName: 'Kumar',
    passwordHash,
    role: 'SUPERVISOR' as any,
    organizationId: org.id,
    isActive: true,
  });
  await userRepo.save(supervisor);

  const investigator = userRepo.create({
    email: 'investigator@chainsentinel.gov.in',
    firstName: 'Priya',
    lastName: 'Sharma',
    passwordHash,
    role: 'INVESTIGATOR' as any,
    organizationId: org.id,
    isActive: true,
  });
  await userRepo.save(investigator);
  console.log('Users created');

  // Create VASPs
  const v1 = vaspRepo.create({
    name: 'WazirX Exchange',
    type: 'centralized_exchange',
    wallets: ['0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', 'TLa5QHaZJEU5ErDh4R4xFN3uLQ6DnKcRXf'],
    chains: ['ETHEREUM', 'TRON'] as any,
    jurisdiction: 'India',
    source: 'Manual Intelligence',
    confidence: 95,
    verificationStatus: 'VERIFIED',
    firstSeen: new Date('2024-01-01'),
    lastUpdated: new Date(),
    metadata: { website: 'wazirx.com' },
  });
  await vaspRepo.save(v1);

  const v2 = vaspRepo.create({
    name: 'Binance',
    type: 'centralized_exchange',
    wallets: ['0x28C6c06298d514Db089934071355E5743bf21d60'],
    chains: ['ETHEREUM'] as any,
    jurisdiction: 'Global',
    source: 'Public Labels',
    confidence: 99,
    verificationStatus: 'VERIFIED',
    firstSeen: new Date('2020-01-01'),
    lastUpdated: new Date(),
    metadata: { website: 'binance.com' },
  });
  await vaspRepo.save(v2);

  const v3 = vaspRepo.create({
    name: 'THORChain Bridge',
    type: 'bridge',
    wallets: ['0x48c92b1688c096d1072c5a43c07d0a23c6b52616'],
    chains: ['ETHEREUM', 'BITCOIN'] as any,
    jurisdiction: 'Decentralized',
    source: 'Chain Analysis',
    confidence: 92,
    verificationStatus: 'VERIFIED',
    firstSeen: new Date('2021-06-01'),
    lastUpdated: new Date(),
    metadata: {},
  });
  await vaspRepo.save(v3);

  const v4 = vaspRepo.create({
    name: 'Tornado Cash',
    type: 'mixer',
    wallets: ['0xd90e2f925da726b50c4ed8d0fb90ad053324bc31'],
    chains: ['ETHEREUM'] as any,
    jurisdiction: 'Decentralized',
    source: 'OFAC Sanctions',
    confidence: 100,
    verificationStatus: 'VERIFIED',
    firstSeen: new Date('2019-01-01'),
    lastUpdated: new Date(),
    metadata: { sanctioned: true },
  });
  await vaspRepo.save(v4);
  console.log('VASPs created');

  // Demo addresses
  const suspectAddr = '0x1234567890abcdef1234567890abcdef12345678';
  const burner1 = '0xabcdef1234567890abcdef1234567890abcdef12';
  const burner2 = '0x9876543210fedcba9876543210fedcba98765432';
  const burner3 = '0x1111222233334444555566667777888899990000';
  const dexRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  const bridgeAddr = '0x48c92b1688c096d1072c5a43c07d0a23c6b52616';
  const vaspWallet = '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0';
  const consolidationWallet = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  const tronSuspect = 'TN2YzL5uQfVqPqHJaRM7U8kRV5F5uNc2RY';
  const tronVasp = 'TLa5QHaZJEU5ErDh4R4xFN3uLQ6DnKcRXf';

  const walletData = [
    { address: suspectAddr, blockchain: 'ETHEREUM' as any, label: 'Suspect Wallet', riskScore: 85, riskLevel: 'HIGH' as any, entityLabel: 'Suspicious' },
    { address: burner1, blockchain: 'ETHEREUM' as any, riskScore: 70, riskLevel: 'HIGH' as any, entityLabel: 'Intermediary' },
    { address: burner2, blockchain: 'ETHEREUM' as any, riskScore: 75, riskLevel: 'HIGH' as any, entityLabel: 'Intermediary' },
    { address: burner3, blockchain: 'ETHEREUM' as any, riskScore: 65, riskLevel: 'MEDIUM' as any, entityLabel: 'Burner' },
    { address: dexRouter, blockchain: 'ETHEREUM' as any, label: 'Uniswap V3 Router', entityLabel: 'DEX Router', riskScore: 10, riskLevel: 'LOW' as any },
    { address: bridgeAddr, blockchain: 'ETHEREUM' as any, label: 'THORChain Router', entityLabel: 'Bridge', riskScore: 30, riskLevel: 'MEDIUM' as any },
    { address: vaspWallet, blockchain: 'ETHEREUM' as any, label: 'WazirX Hot Wallet', entityLabel: 'Centralized Exchange', riskScore: 5, riskLevel: 'LOW' as any },
    { address: consolidationWallet, blockchain: 'ETHEREUM' as any, label: 'Consolidation', riskScore: 80, riskLevel: 'HIGH' as any, entityLabel: 'Aggregation' },
    { address: tronSuspect, blockchain: 'TRON' as any, label: 'TRON Suspect', riskScore: 82, riskLevel: 'HIGH' as any },
    { address: tronVasp, blockchain: 'TRON' as any, label: 'WazirX TRON', entityLabel: 'Centralized Exchange', riskScore: 5, riskLevel: 'LOW' as any },
  ];
  const wallets: Wallet[] = [];
  for (const wd of walletData) {
    const w = walletRepo.create(wd);
    await walletRepo.save(w);
    wallets.push(w);
  }
  console.log('Wallets created');

  // Demo transactions
  const now = Date.now();
  const hour = 3600000;

  const txEntities: NormalizedTransaction[] = [];
  for (let i = 0; i < 5; i++) {
    txEntities.push(txRepo.create({
      chain: 'ETHEREUM' as any,
      txHash: `0x${uuidv4().replace(/-/g, '')}`,
      blockNumber: 19000000 + i,
      timestamp: new Date(now - 10 * hour + i * 300000),
      from: suspectAddr,
      to: burner1,
      asset: 'USDT',
      amountRaw: String(5000 + Math.random() * 2000),
      amountNormalized: String((5000 + Math.random() * 2000).toFixed(2)),
      status: 'confirmed' as any,
      transactionType: 'transfer',
    }));
  }
  for (let i = 0; i < 3; i++) {
    txEntities.push(txRepo.create({
      chain: 'ETHEREUM' as any,
      txHash: `0x${uuidv4().replace(/-/g, '')}`,
      blockNumber: 19000005 + i,
      timestamp: new Date(now - 8 * hour + i * 600000),
      from: burner1,
      to: burner2,
      asset: 'USDT',
      amountRaw: String(3000 + Math.random() * 2000),
      amountNormalized: String((3000 + Math.random() * 2000).toFixed(2)),
      status: 'confirmed' as any,
      transactionType: 'transfer',
    }));
  }
  txEntities.push(txRepo.create({
    chain: 'ETHEREUM' as any, txHash: `0x${uuidv4().replace(/-/g, '')}`,
    blockNumber: 19000009, timestamp: new Date(now - 6 * hour),
    from: burner2, to: dexRouter, asset: 'USDT',
    amountRaw: '10000000000', amountNormalized: '10000',
    status: 'confirmed' as any, transactionType: 'swap',
  }));
  txEntities.push(txRepo.create({
    chain: 'ETHEREUM' as any, txHash: `0x${uuidv4().replace(/-/g, '')}`,
    blockNumber: 19000012, timestamp: new Date(now - 4 * hour),
    from: burner3, to: bridgeAddr, asset: 'ETH',
    amountRaw: '3400000000000000000', amountNormalized: '3.4',
    status: 'confirmed' as any, transactionType: 'bridge',
  }));
  txEntities.push(txRepo.create({
    chain: 'ETHEREUM' as any, txHash: `0x${uuidv4().replace(/-/g, '')}`,
    blockNumber: 19000015, timestamp: new Date(now - 2 * hour),
    from: consolidationWallet, to: vaspWallet, asset: 'USDT',
    amountRaw: '42500000000', amountNormalized: '42500',
    status: 'confirmed' as any, transactionType: 'deposit',
  }));
  txEntities.push(txRepo.create({
    chain: 'TRON' as any, txHash: `tron_tx_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
    blockNumber: 55000100, timestamp: new Date(now - 1 * hour),
    from: tronSuspect, to: tronVasp, asset: 'USDT',
    amountRaw: '8000000000', amountNormalized: '8000',
    status: 'confirmed' as any, transactionType: 'deposit',
  }));
  for (const tx of txEntities) {
    await txRepo.save(tx);
  }
  console.log(`${txEntities.length} transactions created`);

  // Case
  const caseEntity = caseRepo.create({
    caseNumber: 'NCRP-2026-000482',
    title: 'Cryptocurrency Investment Fraud - USDT Theft',
    status: 'ACTIVE' as any,
    fraudType: 'INVESTMENT_SCAM' as any,
    description: 'Victim lost 50,000 USDT through fraudulent investment platform.',
    organizationId: org.id,
    riskLevel: 'CRITICAL' as any,
    assignedInvestigatorId: investigator.id,
    supervisorId: supervisor.id,
    createdBy: investigator.id,
  });
  await caseRepo.save(caseEntity);

  const complaint = complaintRepo.create({
    caseId: caseEntity.id,
    complaintNumber: 'CMP-NCRP-2026-000482',
    victimReference: 'VICTIM-2026-0042',
    suspectWalletAddress: suspectAddr,
    blockchain: 'ETHEREUM' as any,
    cryptocurrency: 'USDT',
    estimatedFraudAmount: '50000',
    reportedTimestamp: new Date(now - 24 * hour),
    description: 'Victim was approached through social media for a cryptocurrency investment opportunity.',
  });
  await complaintRepo.save(complaint);
  console.log('Case created');

  // Investigation
  const investigation = invRepo.create({
    caseId: caseEntity.id,
    status: 'COMPLETED' as any,
    currentStage: 'INVESTIGATION_COMPLETED' as any,
    progress: 100,
    message: 'Investigation completed',
    suspectWallet: suspectAddr,
    blockchain: 'ETHEREUM' as any,
    startedAt: new Date(now - 20 * hour),
    completedAt: new Date(now - 18 * hour),
    stats: { transactions: txEntities.length, wallets: wallets.length, bridges: 1, vaspMatches: 2, riskScore: 87, crossChainTransfers: 1 } as any,
  });
  await invRepo.save(investigation);

  const stages = [
    'ADDRESS_VALIDATION', 'CHAIN_DETECTION', 'TRANSACTION_INGESTION',
    'TRANSACTION_NORMALIZATION', 'GRAPH_BUILD', 'FUND_FLOW_TRACE',
    'ENTITY_MATCHING', 'CROSS_CHAIN_ANALYSIS', 'PATTERN_ANALYSIS',
    'RISK_SCORING', 'VASP_ATTRIBUTION', 'CASE_CORRELATION', 'RECOMMENDATION_GENERATION',
  ];
  for (const stage of stages) {
    const job = jobRepo.create({
      investigationId: investigation.id,
      stage: stage as any,
      status: 'COMPLETED',
      progress: 100,
      message: `Completed: ${stage.toLowerCase().replace(/_/g, ' ')}`,
      startedAt: new Date(now - 20 * hour),
      completedAt: new Date(now - 18 * hour),
    });
    await jobRepo.save(job);
  }
  console.log('Investigation created');

  // Risk
  const risk = riskRepo.create({
    walletId: wallets[0].id,
    riskScore: 87,
    riskLevel: 'CRITICAL' as any,
    factors: [
      { factor: 'Rapid Forwarding', score: 20, weight: 20, description: 'Funds forwarded within minutes' },
      { factor: 'Fan-Out Pattern', score: 15, weight: 15, description: 'Split across multiple wallets' },
      { factor: 'Cross-Chain Activity', score: 15, weight: 15, description: 'Bridge interaction detected' },
      { factor: 'Known Fraud Association', score: 25, weight: 25, description: 'Connected to fraud pattern' },
    ] as any,
    fraudPatterns: [
      { patternType: 'rapid_forwarding', confidence: 85, riskContribution: 20, description: 'Funds forwarded within 3 minutes' },
      { patternType: 'fan_out', confidence: 70, riskContribution: 15, description: 'Funds split across 3 wallets' },
    ] as any,
    assessedAt: new Date(),
  });
  await riskRepo.save(risk);

  // Alerts
  const alert1 = alertRepo.create({
    caseId: caseEntity.id, walletAddress: suspectAddr, severity: 'CRITICAL' as any, status: 'UNREAD' as any,
    title: 'Funds reached known VASP', message: '42,500 USDT deposited to WazirX Exchange', type: 'vasp_match',
    metadata: { vasp: 'WazirX', amount: '42500', confidence: 96 },
  });
  await alertRepo.save(alert1);
  const alert2 = alertRepo.create({
    caseId: caseEntity.id, walletAddress: suspectAddr, severity: 'HIGH' as any, status: 'UNREAD' as any,
    title: 'Cross-chain transfer detected', message: 'ETH -> Tron via THORChain', type: 'cross_chain', metadata: {},
  });
  await alertRepo.save(alert2);
  const alert3 = alertRepo.create({
    caseId: caseEntity.id, severity: 'MEDIUM' as any, status: 'READ' as any,
    title: 'Intermediary wallet identified', message: 'Short-lived intermediary wallets detected', type: 'intermediary', metadata: {},
  });
  await alertRepo.save(alert3);

  // Watchlist
  const wl1 = watchlistRepo.create({
    walletAddress: suspectAddr, blockchain: 'ETHEREUM' as any, caseId: caseEntity.id,
    reason: 'Primary suspect', sensitivity: 'CRITICAL' as any, createdBy: investigator.id,
  });
  await watchlistRepo.save(wl1);
  const wl2 = watchlistRepo.create({
    walletAddress: consolidationWallet, blockchain: 'ETHEREUM' as any, caseId: caseEntity.id,
    reason: 'Consolidation wallet', sensitivity: 'HIGH' as any, createdBy: investigator.id,
  });
  await watchlistRepo.save(wl2);

  // Cluster
  const cluster = clusterRepo.create({
    wallets: [suspectAddr, burner1, burner2, burner3],
    confidence: 'PROBABLE',
    reasons: ['Shared counterparties', 'Sequential fund flow'],
    chain: 'ETHEREUM' as any,
  });
  await clusterRepo.save(cluster);

  // Cross-chain
  const cc = crossChainRepo.create({
    sourceChain: 'ETHEREUM' as any, sourceWallet: burner3,
    sourceTransaction: txEntities[txEntities.length - 3]?.txHash || '',
    sourceAsset: 'ETH', bridge: 'THORChain',
    destinationChain: 'TRON' as any, destinationWallet: tronSuspect,
    destinationAsset: 'TRX', confidence: 75, amount: '3.4',
    timestamp: new Date(now - 4 * hour),
  });
  await crossChainRepo.save(cc);

  // Report
  const report = reportRepo.create({
    caseId: caseEntity.id,
    title: 'Investigation Report - NCRP-2026-000482',
    generatedBy: investigator.id,
    sha256Hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
    version: '1.0',
    sections: ['cover', 'case_details', 'fund_flow', 'vasp_attribution', 'risk_analysis'],
    metadata: { demo: true },
  } as any);
  await reportRepo.save(report);

  // Audit
  const audit1 = auditRepo.create({
    actorId: investigator.id, actorEmail: investigator.email, organizationId: org.id,
    action: 'LOGIN', resourceType: 'AUTH', result: 'SUCCESS',
  });
  await auditRepo.save(audit1);
  const audit2 = auditRepo.create({
    actorId: investigator.id, actorEmail: investigator.email, organizationId: org.id,
    action: 'CASE_CREATED', resourceType: 'CASE', resourceId: caseEntity.id, result: 'SUCCESS',
  });
  await auditRepo.save(audit2);

  console.log('\n✅ Seed completed!');
  console.log('\nDefault users created (change passwords immediately):');
  console.log('  Admin:         admin@chainsentinel.gov.in');
  console.log('  Investigator:  investigator@chainsentinel.gov.in');
  console.log(`\n  Demo Case:     NCRP-2026-000482`);
  console.log(`  Suspect Wallet: ${suspectAddr}`);

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
