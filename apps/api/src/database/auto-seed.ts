import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
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
import { BlockchainApiConfig } from './entities/blockchain-api-config.entity';
import { BlockchainFallbackConfig } from './entities/blockchain-fallback-config.entity';
import { UserRole, BlockchainType, CaseStatus, FraudType, RiskLevel, AlertSeverity, AlertStatus, TransactionStatus, InvestigationStatus, InvestigationStage, NodeKind, AttributionState, VerificationStatus } from '@chainsentinel/types';
import { v4 as uuidv4 } from 'uuid';

export async function runAutoSeed(dataSource: DataSource) {
  try {
    const userRepo = dataSource.getRepository(User);
    const orgRepo = dataSource.getRepository(Organization);
    const vaspRepo = dataSource.getRepository(VASP);
    const bcRepo = dataSource.getRepository(BlockchainApiConfig);
    const walletRepo = dataSource.getRepository(Wallet);
    const txRepo = dataSource.getRepository(NormalizedTransaction);
    const caseRepo = dataSource.getRepository(Case);
    const complaintRepo = dataSource.getRepository(Complaint);
    const invRepo = dataSource.getRepository(Investigation);
    const alertRepo = dataSource.getRepository(Alert);
    const watchlistRepo = dataSource.getRepository(WatchlistEntry);

    let org = await orgRepo.findOne({ where: { code: 'CCIU' } });
    if (!org) {
      org = orgRepo.create({
        name: 'Cyber Crime Investigation Unit',
        code: 'CCIU',
        isActive: true,
        settings: { theme: 'dark', notifications: true },
      });
      await orgRepo.save(org);
    }

    // Check if admin@sih.com exists
    let sihAdmin = await userRepo.findOne({ where: { email: 'admin@sih.com' } });
    const sihPasswordHash = await bcrypt.hash('Admin@123', 12);
    if (!sihAdmin) {
      sihAdmin = userRepo.create({
        email: 'admin@sih.com',
        firstName: 'SIH',
        lastName: 'Admin',
        passwordHash: sihPasswordHash,
        role: UserRole.SUPER_ADMIN,
        organizationId: org.id,
        isActive: true,
      });
      await userRepo.save(sihAdmin);
    } else {
      sihAdmin.passwordHash = sihPasswordHash;
      sihAdmin.role = UserRole.SUPER_ADMIN;
      sihAdmin.isActive = true;
      sihAdmin.failedLoginAttempts = 0;
      sihAdmin.lockedUntil = null as any;
      await userRepo.save(sihAdmin);
    }

    // Default users
    const defaultPasswordHash = await bcrypt.hash('ChangeMeImmediately!', 12);
    let existingAdmin = await userRepo.findOne({ where: { email: 'admin@chainsentinel.gov.in' } });
    if (!existingAdmin) {
      await userRepo.save(userRepo.create({
        email: 'admin@chainsentinel.gov.in',
        firstName: 'System',
        lastName: 'Admin',
        passwordHash: defaultPasswordHash,
        role: UserRole.SUPER_ADMIN,
        organizationId: org.id,
        isActive: true,
      }));
    } else {
      existingAdmin.passwordHash = defaultPasswordHash;
      existingAdmin.isActive = true;
      existingAdmin.failedLoginAttempts = 0;
      existingAdmin.lockedUntil = null as any;
      await userRepo.save(existingAdmin);
    }

    let investigator = await userRepo.findOne({ where: { email: 'investigator@chainsentinel.gov.in' } });
    if (!investigator) {
      investigator = await userRepo.save(userRepo.create({
        email: 'investigator@chainsentinel.gov.in',
        firstName: 'Priya',
        lastName: 'Sharma',
        passwordHash: defaultPasswordHash,
        role: UserRole.INVESTIGATOR,
        organizationId: org.id,
        isActive: true,
      }));
    } else {
      investigator.passwordHash = defaultPasswordHash;
      investigator.isActive = true;
      investigator.failedLoginAttempts = 0;
      investigator.lockedUntil = null as any;
      await userRepo.save(investigator);
    }

    // Seed Blockchain API Configs
    // Seed Blockchain API Configs with Real Verified APIs (TronGrid, Etherscan v2, Chainabuse)
    const etherscanKey = process.env.ETHERSCAN_API_KEY || 'FZRYRUQ3CS59SREXG3G6F9HCY5DNWMYZPY';
    const trongridKey = process.env.TRONGRID_API_KEY || 'a20c9225-33d8-4bab-a7e5-f01664db040e';
    const chainabuseKey = process.env.CHAINABUSE_API_KEY || 'ca_QlI1djRYTU14eEh6Y3J2M0w4cVczQzZ6LjUrTjVPNkFGcVdhelpiTXlZZ2dsT3c9PQ';

    let ethConfig = await bcRepo.findOne({ where: { chain: BlockchainType.ETHEREUM } });
    if (!ethConfig) {
      ethConfig = bcRepo.create({
        chain: BlockchainType.ETHEREUM,
        name: 'Ethereum Mainnet',
        chainId: '1',
        nativeToken: 'ETH',
        dataModel: 'ACCOUNT',
        primaryProviderName: 'Etherscan',
        primaryEndpointUrl: 'https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey={API_KEY}',
        apiKey: etherscanKey,
        addressRegex: '^0x[a-fA-F0-9]{40}$',
        checksumType: 'EIP-55',
        status: 'live',
        isActive: true,
        vaspWallets: { "WazirX": "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", "Binance": "0x28C6c06298d514Db089934071355E5743bf21d60" },
      });
      await bcRepo.save(ethConfig);
    } else {
      ethConfig.primaryEndpointUrl = 'https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey={API_KEY}';
      ethConfig.apiKey = etherscanKey;
      ethConfig.status = 'live';
      await bcRepo.save(ethConfig);
    }

    let tronConfig = await bcRepo.findOne({ where: { chain: BlockchainType.TRON } });
    if (!tronConfig) {
      tronConfig = bcRepo.create({
        chain: BlockchainType.TRON,
        name: 'TRON Mainnet',
        chainId: 'TRX',
        nativeToken: 'TRX',
        dataModel: 'ACCOUNT',
        primaryProviderName: 'TronGrid',
        primaryEndpointUrl: 'https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions',
        apiKey: trongridKey,
        addressRegex: '^T[a-zA-Z0-9]{33}$',
        status: 'live',
        isActive: true,
      });
      await bcRepo.save(tronConfig);
    } else {
      tronConfig.apiKey = trongridKey;
      tronConfig.status = 'live';
      await bcRepo.save(tronConfig);
    }

    let btcConfig = await bcRepo.findOne({ where: { chain: BlockchainType.BITCOIN } });
    if (!btcConfig) {
      btcConfig = bcRepo.create({
        chain: BlockchainType.BITCOIN,
        name: 'Bitcoin Mainnet',
        chainId: 'BTC',
        nativeToken: 'BTC',
        dataModel: 'UTXO',
        primaryProviderName: 'Mempool.space',
        primaryEndpointUrl: 'https://mempool.space/api/address/{ADDRESS}/txs',
        apiKey: '',
        addressRegex: '^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$',
        status: 'live',
        isActive: true,
      });
      await bcRepo.save(btcConfig);
    }

    let polygonConfig = await bcRepo.findOne({ where: { chain: BlockchainType.POLYGON } });
    if (!polygonConfig) {
      polygonConfig = bcRepo.create({
        chain: BlockchainType.POLYGON,
        name: 'Polygon Mainnet',
        chainId: '137',
        nativeToken: 'MATIC',
        dataModel: 'ACCOUNT',
        primaryProviderName: 'Polygonscan',
        primaryEndpointUrl: 'https://api.polygonscan.com/api?module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&sort=asc&apikey={API_KEY}',
        apiKey: process.env.POLYGONSCAN_API_KEY || '',
        addressRegex: '^0x[a-fA-F0-9]{40}$',
        status: process.env.POLYGONSCAN_API_KEY ? 'live' : 'mock',
        isActive: true,
      });
      await bcRepo.save(polygonConfig);
    }


    // Seed / Enrich VASPs
    const realVaspsData = [
      {
        name: 'WazirX Exchange',
        type: 'centralized_exchange',
        wallets: ['0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', 'TLa5QHaZJEU5ErDh4R4xFN3uLQ6DnKcRXf'],
        chains: [BlockchainType.ETHEREUM, BlockchainType.TRON],
        jurisdiction: 'India',
        source: 'FIU-IND Reporting Entity Registry',
        confidence: 98,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2021-01-01'),
        lastUpdated: new Date(),
        metadata: {
          website: 'wazirx.com',
          complianceOfficer: 'Nodal Officer - FIU-IND Registered VASP (Zanmai Labs Pvt Ltd)',
          complianceEmail: 'lawenforcement@wazirx.com / nodalofficer@wazirx.com',
          legalEntity: 'Zanmai Labs Pvt Ltd (Mumbai, India)',
          fiuRegistrationNumber: 'FIU-IND/VASP/2023/048',
          crpcSection91Supported: true,
          freezeMechanism: 'Emergency Freezing Desk / Indian Police Liaison Portal',
          avgResponseHours: 2,
          description: 'Premier Indian VASP operating under FIU-IND regulatory reporting compliance.'
        },
      },
      {
        name: 'Binance',
        type: 'centralized_exchange',
        wallets: [
          '0x28C6c06298d514Db089934071355E5743bf21d60',
          '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549',
          '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
          'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxbYZ7'
        ],
        chains: [BlockchainType.ETHEREUM, BlockchainType.TRON, BlockchainType.BITCOIN],
        jurisdiction: 'Global / Multiple Entities',
        source: 'Public Proof-of-Reserves & Cluster Verification',
        confidence: 99,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2019-01-01'),
        lastUpdated: new Date(),
        metadata: {
          website: 'binance.com',
          complianceOfficer: 'Binance Special Investigations & Law Enforcement Requests Desk',
          complianceEmail: 'case@binance.com / le-requests@binance.com',
          legalEntity: 'Binance Holdings Ltd / Nest Services Limited',
          crpcSection91Supported: true,
          freezeMechanism: 'Kodex LE Portal / Subpoena Freeze Order API',
          avgResponseHours: 4,
          description: 'World largest cryptocurrency exchange by trading volume, providing custody, spot, and derivatives.'
        },
      },
      {
        name: 'Coinbase',
        type: 'centralized_exchange',
        wallets: [
          '0x503828976D22510aad0201ac7EC88293211A23Da',
          '0x71660c4005BA85c37ccec55d0C4493E66Fe775d3',
          '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740'
        ],
        chains: [BlockchainType.ETHEREUM, BlockchainType.BITCOIN],
        jurisdiction: 'United States',
        source: 'FinCEN MSB Registration #31000159799988',
        confidence: 99,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2018-01-01'),
        lastUpdated: new Date(),
        metadata: {
          website: 'coinbase.com',
          complianceOfficer: 'Chief Compliance Officer, Coinbase Global, Inc.',
          complianceEmail: 'subpoenas@coinbase.com / lawenforcement@coinbase.com',
          legalEntity: 'Coinbase, Inc. (Delaware, USA)',
          crpcSection91Supported: true,
          freezeMechanism: 'API Direct / Law Enforcement Portal',
          avgResponseHours: 12,
          description: 'US publicly traded cryptocurrency exchange (NASDAQ: COIN) subject to NYDFS BitLicense and FinCEN regulation.'
        },
      },
      {
        name: 'Kraken',
        type: 'centralized_exchange',
        wallets: [
          '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
          '0x0A869d79a7052C7f1b55a8EbA65c49D8Aa456318'
        ],
        chains: [BlockchainType.ETHEREUM, BlockchainType.BITCOIN],
        jurisdiction: 'United States / EU',
        source: 'FinCEN MSB / Payward Inc',
        confidence: 98,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2017-05-01'),
        lastUpdated: new Date(),
        metadata: {
          website: 'kraken.com',
          complianceOfficer: 'Compliance Operations, Payward, Inc.',
          complianceEmail: 'lea@kraken.com',
          legalEntity: 'Payward, Inc. (San Francisco, CA)',
          crpcSection91Supported: true,
          freezeMechanism: 'Direct LE Liaison Desk',
          avgResponseHours: 8,
          description: 'US-based exchange founded in 2011 with extensive regulatory licenses across the US, UK, and Europe.'
        },
      },
      {
        name: 'OKX',
        type: 'centralized_exchange',
        wallets: [
          '0x6cC5F688a30d371E6674eB4E0D9df7C70E103753',
          '0xA7EF42c83B3838E84351336021A46761Efa7FEE6'
        ],
        chains: [BlockchainType.ETHEREUM, BlockchainType.TRON],
        jurisdiction: 'Seychelles / Global',
        source: 'Proof of Reserves Audit',
        confidence: 96,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2019-03-01'),
        lastUpdated: new Date(),
        metadata: {
          website: 'okx.com',
          complianceOfficer: 'Global AML & Sanctions Office',
          complianceEmail: 'enforcement@okx.com',
          legalEntity: 'Aux Cayes FinTech Co. Ltd',
          crpcSection91Supported: true,
          freezeMechanism: 'Online LE Portal',
          avgResponseHours: 24,
          description: 'Global centralized exchange providing high liquidity spot and derivatives markets.'
        },
      },
      {
        name: 'THORChain Bridge',
        type: 'bridge',
        wallets: ['0x48c92b1688c096d1072c5a43c07d0a23c6b52616'],
        chains: [BlockchainType.ETHEREUM, BlockchainType.BITCOIN],
        jurisdiction: 'Decentralized',
        source: 'Chain Analysis & TSS Vault Registry',
        confidence: 94,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2021-06-01'),
        lastUpdated: new Date(),
        metadata: {
          website: 'thorchain.org',
          complianceOfficer: 'Decentralized Liquidity Network / Node Operators',
          complianceEmail: 'N/A (Decentralized)',
          legalEntity: 'None (Permissionless Protocol)',
          crpcSection91Supported: false,
          freezeMechanism: 'Mimir Governance Pausing (Requires 67% Node Consensus)',
          avgResponseHours: null,
          description: 'Decentralized cross-chain liquidity network enabling native asset settlement.'
        },
      },
      {
        name: 'Tornado Cash',
        type: 'mixer',
        wallets: [
          '0xd90e2f925da726b50c4ed8d0fb90ad053324bc31',
          '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
          '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
          '0x7222577874756158bd95558ce9ed23bb24c38d4'
        ],
        chains: [BlockchainType.ETHEREUM],
        jurisdiction: 'Sanctioned / Non-Compliant',
        source: 'OFAC SDN List Identification',
        confidence: 100,
        verificationStatus: 'VERIFIED',
        firstSeen: new Date('2019-12-01'),
        lastUpdated: new Date(),
        metadata: {
          boundaryBehavior: 'trace_boundary',
          website: 'ipfs',
          sanctioned: true,
          regulatoryAlert: 'High Risk Mixer - Designated on OFAC Specially Designated Nationals (SDN) List',
          freezeMechanism: 'Protocol Non-Custodial / Blacklist at VASP Ingress Only',
          description: 'Smart contract mixer sanctioned by the US Department of the Treasury (OFAC).'
        },
      },
    ];

    for (const item of realVaspsData) {
      let existingVasp = await vaspRepo.findOne({ where: { name: item.name } });
      if (!existingVasp) {
        await vaspRepo.save(vaspRepo.create(item as any));
      } else {
        existingVasp.wallets = item.wallets;
        existingVasp.chains = item.chains as any;
        existingVasp.jurisdiction = item.jurisdiction;
        existingVasp.source = item.source;
        existingVasp.confidence = item.confidence;
        existingVasp.verificationStatus = item.verificationStatus;
        existingVasp.metadata = item.metadata;
        existingVasp.lastUpdated = new Date();
        await vaspRepo.save(existingVasp);
      }
    }


    // Seed Wallets & Transactions if empty
    const walletCount = await walletRepo.count();
    if (walletCount === 0) {
      const suspectAddr = '0x1234567890abcdef1234567890abcdef12345678';
      const burner1 = '0xabcdef1234567890abcdef1234567890abcdef12';
      const burner2 = '0x9876543210fedcba9876543210fedcba98765432';
      const burner3 = '0x1111222233334444555566667777888899990000';
      const vaspWallet = '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0';
      const mixerWallet = '0x7222577874756158bd95558ce9ed23bb24c38d4';

      await walletRepo.save([
        walletRepo.create({ address: suspectAddr, blockchain: BlockchainType.ETHEREUM, label: 'Suspect Wallet', riskScore: 85, riskLevel: RiskLevel.HIGH, entityLabel: 'Suspicious' }),
        walletRepo.create({ address: burner1, blockchain: BlockchainType.ETHEREUM, riskScore: 70, riskLevel: RiskLevel.HIGH, entityLabel: 'Intermediary' }),
        walletRepo.create({ address: burner2, blockchain: BlockchainType.ETHEREUM, riskScore: 75, riskLevel: RiskLevel.HIGH, entityLabel: 'Intermediary' }),
        walletRepo.create({ address: burner3, blockchain: BlockchainType.ETHEREUM, riskScore: 65, riskLevel: RiskLevel.MEDIUM, entityLabel: 'Burner' }),
        walletRepo.create({ address: vaspWallet, blockchain: BlockchainType.ETHEREUM, label: 'WazirX Hot Wallet', entityLabel: 'Centralized Exchange', riskScore: 5, riskLevel: RiskLevel.LOW, nodeKind: NodeKind.SERVICE, vaspId: null as any }),
        walletRepo.create({ address: mixerWallet, blockchain: BlockchainType.ETHEREUM, label: 'Tornado Cash', entityLabel: 'MIXER', riskScore: 95, riskLevel: RiskLevel.CRITICAL, nodeKind: NodeKind.SERVICE }),
        // RULES §2: miner/validator stored as infra node — never part of fund-flow facts unless escalated
        walletRepo.create({ address: '0x0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa', blockchain: BlockchainType.ETHEREUM, label: 'Block Producer (demo)', entityLabel: 'MINER', riskScore: 0, riskLevel: RiskLevel.LOW, nodeKind: NodeKind.INFRA }),
      ]);

      const now = Date.now();
      const hour = 3600000;

      await txRepo.save([
        txRepo.create({
          chain: BlockchainType.ETHEREUM,
          txHash: `0x${uuidv4().replace(/-/g, '')}`,
          blockNumber: 19000001,
          timestamp: new Date(now - 10 * hour),
          from: suspectAddr,
          to: burner1,
          asset: 'USDT',
          amountRaw: '5000000000',
          amountNormalized: '5000',
          status: TransactionStatus.CONFIRMED,
          // Demo data has a single source: honestly tagged UNVERIFIED (CONDITION 1.1)
          verificationStatus: VerificationStatus.UNVERIFIED,
          dataSource: 'seed (single-source)',
          collectedAt: new Date(),
          syncState: 'SYNCED',
          // RULES §2: producer metadata tagged even when not investigated
          producerAddress: '0x0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa',
          producerType: 'miner',
          consensusMetadata: { blockTime: '12s', note: 'demo metadata' },
          transactionType: 'transfer',
        }),
        txRepo.create({
          chain: BlockchainType.ETHEREUM,
          txHash: `0x${uuidv4().replace(/-/g, '')}`,
          blockNumber: 19000005,
          timestamp: new Date(now - 8 * hour),
          from: burner1,
          to: burner2,
          asset: 'USDT',
          amountRaw: '5000000000',
          amountNormalized: '5000',
          status: TransactionStatus.CONFIRMED,
          verificationStatus: VerificationStatus.UNVERIFIED,
          dataSource: 'seed (single-source)',
          collectedAt: new Date(),
          syncState: 'SYNCED',
          producerAddress: '0x0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa',
          producerType: 'miner',
          consensusMetadata: { blockTime: '12s', note: 'demo metadata' },
          transactionType: 'transfer',
        }),
      ]);

      // Seed Case
      const caseEntity = await caseRepo.save(caseRepo.create({
        caseNumber: 'NCRP-2026-000482',
        title: 'Cryptocurrency Investment Fraud - USDT Theft',
        status: CaseStatus.ACTIVE,
        fraudType: FraudType.INVESTMENT_SCAM,
        description: 'Victim lost 50,000 USDT through fraudulent investment platform.',
        organizationId: org.id,
        riskLevel: RiskLevel.CRITICAL,
        assignedInvestigatorId: investigator?.id,
        createdBy: investigator?.id || sihAdmin.id,
      }));

      await complaintRepo.save(complaintRepo.create({
        caseId: caseEntity.id,
        complaintNumber: 'CMP-NCRP-2026-000482',
        victimReference: 'VICTIM-2026-0042',
        suspectWalletAddress: suspectAddr,
        blockchain: BlockchainType.ETHEREUM,
        cryptocurrency: 'USDT',
        estimatedFraudAmount: '50000',
        reportedTimestamp: new Date(now - 24 * hour),
        description: 'Victim was approached through social media.',
      }));

      await invRepo.save(invRepo.create({
        caseId: caseEntity.id,
        status: InvestigationStatus.COMPLETED,
        currentStage: InvestigationStage.INVESTIGATION_COMPLETED,
        progress: 100,
        message: 'Investigation completed',
        suspectWallet: suspectAddr,
        blockchain: BlockchainType.ETHEREUM,
        startedAt: new Date(now - 20 * hour),
        completedAt: new Date(now - 18 * hour),
        stats: { transactions: 2, wallets: 5, riskScore: 85 } as any,
      }));

      await alertRepo.save([
        alertRepo.create({
          caseId: caseEntity.id, walletAddress: suspectAddr, severity: AlertSeverity.CRITICAL, status: AlertStatus.UNREAD,
          title: 'Funds reached known VASP', message: '42,500 USDT deposited to WazirX Exchange', type: 'vasp_match',
          metadata: { vasp: 'WazirX', amount: '42500', confidence: 96 },
        }),
      ]);

      await watchlistRepo.save([
        watchlistRepo.create({
          walletAddress: suspectAddr, blockchain: BlockchainType.ETHEREUM, caseId: caseEntity.id,
          reason: 'Primary suspect', sensitivity: RiskLevel.CRITICAL as any, createdBy: sihAdmin.id,
        }),
      ]);
    }

    console.log('✅ Database auto-seed verified. Super Admin ready: admin@sih.com');
  } catch (err: any) {
    console.error('Auto-seed error:', err.message);
  }
}


