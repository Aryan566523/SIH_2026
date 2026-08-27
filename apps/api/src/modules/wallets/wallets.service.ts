import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../database/entities/wallet.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { BlockchainType } from '@chainsentinel/types';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(RiskAssessment) private riskRepo: Repository<RiskAssessment>,
    @InjectRepository(Attribution) private attrRepo: Repository<Attribution>,
  ) {}

  async findOrCreate(address: string, blockchain: BlockchainType): Promise<Wallet> {
    let wallet = await this.walletRepo.findOne({ where: { address, blockchain } });
    if (!wallet) {
      wallet = this.walletRepo.create({ address, blockchain });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }

  async findByAddress(address: string, blockchain?: BlockchainType): Promise<Wallet> {
    const where: any = { address };
    if (blockchain) where.blockchain = blockchain;

    const wallet = await this.walletRepo.findOne({ where, relations: ['watchlistEntries'] });
    if (!wallet) throw new NotFoundException(`Wallet ${address} not found`);
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

    const qb = this.txRepo.createQueryBuilder('t')
      .where('t.from = :address OR t.to = :address', { address: walletAddress })
      .orderBy('t.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.chain) {
      qb.andWhere('t.chain = :chain', { chain: options.chain });
    }

    const [txs, total] = await qb.getManyAndCount();
    return { data: txs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getRiskAssessment(walletId: string): Promise<RiskAssessment | null> {
    return this.riskRepo.findOne({ where: { walletId }, order: { assessedAt: 'DESC' } });
  }

  async getAttributions(walletId: string): Promise<Attribution[]> {
    return this.attrRepo.find({ where: { walletId }, order: { confidence: 'DESC' } });
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
    return this.walletRepo
      .createQueryBuilder('w')
      .where('w.address ILIKE :query', { query: `%${query}%` })
      .orWhere('w.label ILIKE :query', { query: `%${query}%` })
      .orWhere('w.entityLabel ILIKE :query', { query: `%${query}%` })
      .take(limit)
      .getMany();
  }
}
