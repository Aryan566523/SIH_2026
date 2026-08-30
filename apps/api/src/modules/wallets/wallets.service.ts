import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Wallet } from '../../database/entities/wallet.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { BlockchainType, RiskLevel, TransactionStatus } from '@chainsentinel/types';
import { BlockchainProviderFactory } from '../blockchain-config/blockchain-provider.factory';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(RiskAssessment) private riskRepo: Repository<RiskAssessment>,
    @InjectRepository(Attribution) private attrRepo: Repository<Attribution>,
    private readonly providerFactory: BlockchainProviderFactory,
  ) {}

  private detectChain(address: string): BlockchainType {
    const trimmed = address.trim();
    if (/^T[a-zA-Z0-9]{33}$/.test(trimmed)) return BlockchainType.TRON;
    if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/i.test(trimmed)) return BlockchainType.BITCOIN;
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return BlockchainType.ETHEREUM;
    return BlockchainType.ETHEREUM;
  }

  private getKnownEntityInfo(address: string): { label: string; entityLabel: string; riskScore: number; riskLevel: RiskLevel } {
    const lower = address.toLowerCase();
    if (lower === '1feexv6bxk2vp1xfn5v3hel54qhq818fdf'.toLowerCase()) {
      return { label: 'Mt. Gox Stolen Funds', entityLabel: 'HACKER_HOT_WALLET', riskScore: 98, riskLevel: RiskLevel.CRITICAL };
    }
    if (lower === '1ne2nighhbkfpseynwwj7hkghgdedbtsrq'.toLowerCase() || lower.includes('dedbtsrq')) {
      return { label: 'OFAC SDN - IRGC / SecondEye', entityLabel: 'SANCTIONED_ENTITY', riskScore: 99, riskLevel: RiskLevel.CRITICAL };
    }
    if (lower === '19d8phbjzh29us1upz4m3svyqqff8ufg9o'.toLowerCase()) {
      return { label: 'OFAC SDN - IRGC Cyber Unit', entityLabel: 'SANCTIONED_ENTITY', riskScore: 99, riskLevel: RiskLevel.CRITICAL };
    }
    if (lower === 'txn3hvukebhyyr31ypcyd7ajavmuexu1ab'.toLowerCase()) {
      return { label: 'Shelbit Exchange (OFAC SDN)', entityLabel: 'ILLICIT_EXCHANGE', riskScore: 95, riskLevel: RiskLevel.CRITICAL };
    }
    if (lower === 'tfctxpugkplcrf6pwj8zoy6via8mbcrm5d'.toLowerCase() || lower === 'terxbdrkqvq8w4txgmobrqh2wwgt8oqrek'.toLowerCase()) {
      return { label: 'Tether Blacklisted / Frozen USDT', entityLabel: 'FROZEN_WALLET', riskScore: 92, riskLevel: RiskLevel.CRITICAL };
    }
    if (lower === '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0'.toLowerCase()) {
      return { label: 'WazirX Deposit Hot Wallet', entityLabel: 'REGULATED_VASP', riskScore: 12, riskLevel: RiskLevel.LOW };
    }
    if (lower === '0x28c6c06298d514db089934071355e5743bf21d60'.toLowerCase() || lower === 'tn3w4h6rk2ce4vx9ynfqhwkennhjoxbyz7'.toLowerCase()) {
      return { label: 'Binance Cold / Hot Wallet', entityLabel: 'REGULATED_VASP', riskScore: 15, riskLevel: RiskLevel.LOW };
    }
    if (lower === '34xp4vrocgjym3xr7ycvpfhocnxv4twseo'.toLowerCase()) {
      return { label: 'Binance BTC Cold Storage', entityLabel: 'REGULATED_VASP', riskScore: 10, riskLevel: RiskLevel.LOW };
    }
    return {
      label: `${address.slice(0, 6)}...${address.slice(-4)}`,
      entityLabel: 'UNLABELED_ADDRESS',
      riskScore: 35,
      riskLevel: RiskLevel.MEDIUM,
    };
  }

  async findOrCreate(address: string, blockchain?: BlockchainType): Promise<Wallet> {
    const chain = blockchain || this.detectChain(address);
    let wallet = await this.walletRepo.findOne({ where: { address, blockchain: chain } });
    if (!wallet) {
      const info = this.getKnownEntityInfo(address);
      wallet = this.walletRepo.create({
        address,
        blockchain: chain,
        label: info.label,
        entityLabel: info.entityLabel,
        riskScore: info.riskScore,
        riskLevel: info.riskLevel,
      });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }

  async findByAddress(address: string, blockchain?: BlockchainType): Promise<Wallet> {
    const chain = blockchain || this.detectChain(address);
    let wallet = await this.walletRepo.findOne({
      where: { address },
    });

    if (!wallet) {
      wallet = await this.findOrCreate(address, chain);
    }
    return wallet;
  }

  async getById(id: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getTransactions(walletAddress: string, options?: { page?: number; limit?: number; chain?: BlockchainType }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    let [txs, total] = await this.txRepo.createQueryBuilder('t')
      .where('t.from = :address OR t.to = :address', { address: walletAddress })
      .orderBy('t.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // If no transactions exist in DB, fetch live and populate DB
    if (total === 0) {
      try {
        const liveData = await this.providerFactory.fetchTransactions(walletAddress);
        const liveTxs = liveData.transactions || [];
        const detectedChain = this.detectChain(walletAddress);

        for (const tx of liveTxs) {
          try {
            const rawAmount = tx.value || '0';
            const numVal = parseFloat(rawAmount) || 0;
            const normalizedAmount = numVal > 1e12 ? (numVal / 1e18).toFixed(4) : numVal.toString();

            const entity = this.txRepo.create({
              txHash: tx.hash || `0x${Math.random().toString(16).slice(2, 10)}`,
              chain: detectedChain,
              from: tx.from || walletAddress,
              to: tx.to || 'UNKNOWN',
              asset: tx.tokenSymbol || (detectedChain === BlockchainType.TRON ? 'TRX' : detectedChain === BlockchainType.BITCOIN ? 'BTC' : 'ETH'),
              amountRaw: rawAmount,
              amountNormalized: normalizedAmount,
              status: TransactionStatus.CONFIRMED,
              timestamp: new Date(tx.timestamp || Date.now()),
              transactionType: 'transfer',
            });
            await this.txRepo.save(entity);
          } catch {
            // ignore duplicate keys
          }
        }

        // Re-query from DB
        [txs, total] = await this.txRepo.createQueryBuilder('t')
          .where('t.from = :address OR t.to = :address', { address: walletAddress })
          .orderBy('t.timestamp', 'DESC')
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount();

        await this.updateStats(walletAddress, detectedChain);
      } catch (err) {
        this.logger.warn(`Failed to sync live transactions for ${walletAddress}: ${(err as any).message}`);
      }
    }

    return { data: txs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getRiskAssessment(walletId: string): Promise<RiskAssessment | null> {
    const existing = await this.riskRepo.findOne({ where: { walletId }, order: { assessedAt: 'DESC' } });
    if (existing) return existing;

    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) return null;

    // Create default assessment
    const assessment = this.riskRepo.create({
      walletId: wallet.id,
      riskScore: wallet.riskScore || 40,
      riskLevel: wallet.riskLevel || RiskLevel.MEDIUM,
      factors: [
        { factor: 'Entity Classification', score: wallet.riskScore || 35, weight: 0.4, description: wallet.entityLabel || 'General Address' },
        { factor: 'Velocity Analysis', score: 35, weight: 0.3, description: 'Rapid movement detection' },
        { factor: 'VASP Interaction Proximity', score: 45, weight: 0.3, description: 'Proximity to regulated exchanges' },
      ],
      fraudPatterns: [],
      assessedAt: new Date(),
    });
    return this.riskRepo.save(assessment);
  }

  async getAttributions(walletId: string): Promise<Attribution[]> {
    const existing = await this.attrRepo.find({ where: { walletId }, order: { confidence: 'DESC' } });
    if (existing.length > 0) return existing;

    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) return [];

    if (wallet.label?.includes('Binance') || wallet.label?.includes('WazirX')) {
      const vaspName = wallet.label.includes('Binance') ? 'Binance' : 'WazirX';
      const attr = this.attrRepo.create({
        walletId: wallet.id,
        vaspId: vaspName,
        confidence: 0.98,
        distance: 1,
        traceableAmount: '1000',
        crossChain: false,
        path: [wallet.address],
        labelSource: 'automated_registry',
        factors: [],
      });
      const saved = await this.attrRepo.save(attr);
      return [saved];
    }
    return [];
  }

  async updateStats(address: string, blockchain: BlockchainType): Promise<void> {
    const txs = await this.txRepo.find({
      where: [
        { from: address, chain: blockchain },
        { to: address, chain: blockchain },
      ],
    });

    let totalReceived = 0;
    let totalSent = 0;
    let firstSeen: Date | null = null;
    let lastSeen: Date | null = null;

    for (const tx of txs) {
      const amount = parseFloat(tx.amountNormalized) || 0;
      if (tx.to === address) totalReceived += amount;
      if (tx.from === address) totalSent += amount;

      const ts = new Date(tx.timestamp);
      if (!firstSeen || ts < firstSeen) firstSeen = ts;
      if (!lastSeen || ts > lastSeen) lastSeen = ts;
    }

    await this.walletRepo.update(
      { address, blockchain },
      { totalReceived: totalReceived.toString(), totalSent: totalSent.toString(), firstSeen, lastSeen },
    );
  }

  async search(query: string, limit: number = 20): Promise<Wallet[]> {
    const trimmed = (query || '').trim();
    const take = Number(limit) || 20;
    if (!trimmed) {
      return this.walletRepo.find({ take, order: { createdAt: 'DESC' } });
    }

    let wallets = await this.walletRepo.find({
      where: [
        { address: ILike(`%${trimmed}%`) },
        { label: ILike(`%${trimmed}%`) },
        { entityLabel: ILike(`%${trimmed}%`) },
      ],
      take,
    });

    // If query looks like a crypto address and not in DB, create on demand and return
    if (wallets.length === 0 && (
      /^0x[a-fA-F0-9]{15,}/i.test(trimmed) ||
      /^T[a-zA-Z0-9]{15,}/i.test(trimmed) ||
      /^(1|3|bc1)[a-km-zA-HJ-NP-Z0-9]{15,}/i.test(trimmed)
    )) {
      const newWallet = await this.findOrCreate(trimmed);
      wallets = [newWallet];
    }

    return wallets;
  }
}
