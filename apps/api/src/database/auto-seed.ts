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
import { UserRole, BlockchainType, CaseStatus, FraudType, RiskLevel, AlertSeverity, AlertStatus, TransactionStatus, InvestigationStatus, InvestigationStage } from '@chainsentinel/types';
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
      // Ensure password and role are active
      sihAdmin.passwordHash = sihPasswordHash;
      sihAdmin.role = UserRole.SUPER_ADMIN;
      sihAdmin.isActive = true;
      await userRepo.save(sihAdmin);
    }

    // Default users
    const defaultPasswordHash = await bcrypt.hash('ChangeMeImmediately!', 12);
    const existingAdmin = await userRepo.findOne({ where: { email: 'admin@chainsentinel.gov.in' } });
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
    }

    const existingInvestigator = await userRepo.findOne({ where: { email: 'investigator@chainsentinel.gov.in' } });
    let investigator = existingInvestigator;
    if (!investigator) {
      investigator = userRepo.create({
        email: 'investigator@chainsentinel.gov.in',
        firstName: 'Priya',
        lastName: 'Sharma',
        passwordHash: defaultPasswordHash,
        role: UserRole.INVESTIGATOR,
        organizationId: org.id,
        isActive: true,
      });
      await userRepo.save(investigator);
    }

    // Seed Blockchain API Configs
    const bcCount = await bcRepo.count();
    if (bcCount === 0) {
      await bcRepo.save([
        bcRepo.create({
          chain: BlockchainType.ETHEREUM,
          name: 'Ethereum Mainnet',
          chainId: '1',
          nativeToken: 'ETH',
          dataModel: 'ACCOUNT',
          primaryProviderName: 'Etherscan',
          primaryEndpointUrl: 'https://api.etherscan.io/api?module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&sort=asc&apikey={API_KEY}',
          apiKey: process.env.ETHERSCAN_API_KEY || '',
          addressRegex: '^0x[a-fA-F0-9]{40}$',
          checksumType: 'EIP-55',
          status: process.env.ETHERSCAN_API_KEY ? 'live' : 'mock',
          isActive: true,
          vaspWallets: { "WazirX": "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", "Binance": "0x28C6c06298d514Db089934071355E5743bf21d60" },
        }),
        bcRepo.create({
          chain: BlockchainType.TRON,
          name: 'TRON Mainnet',
          chainId: 'TRX',
          nativeToken: 'TRX',
          dataModel: 'ACCOUNT',
          primaryProviderName: 'TronGrid',
          primaryEndpointUrl: 'https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions',
          apiKey: process.env.TRONGRID_API_KEY || '',
          addressRegex: '^T[a-zA-Z0-9]{33}$',
          status: process.env.TRONGRID_API_KEY ? 'live' : 'mock',
          isActive: true,
        }),
        bcRepo.create({
          chain: BlockchainType.BITCOIN,
          name: 'Bitcoin Mainnet',
          chainId: 'BTC',
          nativeToken: 'BTC',
          dataModel: 'UTXO',
          primaryProviderName: 'Blockchain.info',
          primaryEndpointUrl: 'https://blockchain.info/rawaddr/{ADDRESS}',
          apiKey: '',
          addressRegex: '^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$',
          status: 'mock',
          isActive: true,
        }),
        bcRepo.create({
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
        }),
      ]);
    }


    // Seed VASPs if empty
    const vaspCount = await vaspRepo.count();
    if (vaspCount === 0) {
      await vaspRepo.save([
        vaspRepo.create({
          name: 'WazirX Exchange',
          type: 'centralized_exchange',
          wallets: ['0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', 'TLa5QHaZJEU5ErDh4R4xFN3uLQ6DnKcRXf'],
          chains: [BlockchainType.ETHEREUM, BlockchainType.TRON],
          jurisdiction: 'India',
          source: 'Manual Intelligence',
          confidence: 95,
          verificationStatus: 'VERIFIED',
          firstSeen: new Date('2024-01-01'),
          lastUpdated: new Date(),
          metadata: { website: 'wazirx.com' },
        }),
        vaspRepo.create({
          name: 'Binance',
          type: 'centralized_exchange',
          wallets: ['0x28C6c06298d514Db089934071355E5743bf21d60'],
          chains: [BlockchainType.ETHEREUM],
          jurisdiction: 'Global',
          source: 'Public Labels',
          confidence: 99,
          verificationStatus: 'VERIFIED',
          firstSeen: new Date('2020-01-01'),
          lastUpdated: new Date(),
          metadata: { website: 'binance.com' },
        }),
        vaspRepo.create({
          name: 'THORChain Bridge',
          type: 'bridge',
          wallets: ['0x48c92b1688c096d1072c5a43c07d0a23c6b52616'],
          chains: [BlockchainType.ETHEREUM, BlockchainType.BITCOIN],
          jurisdiction: 'Decentralized',
          source: 'Chain Analysis',
          confidence: 92,
          verificationStatus: 'VERIFIED',
          firstSeen: new Date('2021-06-01'),
          lastUpdated: new Date(),
          metadata: {},
        }),
      ]);
    }

    // Seed Wallets & Transactions if empty
    const walletCount = await walletRepo.count();
    if (walletCount === 0) {
      const suspectAddr = '0x1234567890abcdef1234567890abcdef12345678';
      const burner1 = '0xabcdef1234567890abcdef1234567890abcdef12';
      const burner2 = '0x9876543210fedcba9876543210fedcba98765432';
      const burner3 = '0x1111222233334444555566667777888899990000';
      const vaspWallet = '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0';

      await walletRepo.save([
        walletRepo.create({ address: suspectAddr, blockchain: BlockchainType.ETHEREUM, label: 'Suspect Wallet', riskScore: 85, riskLevel: RiskLevel.HIGH, entityLabel: 'Suspicious' }),
        walletRepo.create({ address: burner1, blockchain: BlockchainType.ETHEREUM, riskScore: 70, riskLevel: RiskLevel.HIGH, entityLabel: 'Intermediary' }),
        walletRepo.create({ address: burner2, blockchain: BlockchainType.ETHEREUM, riskScore: 75, riskLevel: RiskLevel.HIGH, entityLabel: 'Intermediary' }),
        walletRepo.create({ address: burner3, blockchain: BlockchainType.ETHEREUM, riskScore: 65, riskLevel: RiskLevel.MEDIUM, entityLabel: 'Burner' }),
        walletRepo.create({ address: vaspWallet, blockchain: BlockchainType.ETHEREUM, label: 'WazirX Hot Wallet', entityLabel: 'Centralized Exchange', riskScore: 5, riskLevel: RiskLevel.LOW }),
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


