import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchlistEntry } from '../../database/entities/watchlist.entity';
import { BlockchainType, WatchlistSensitivity } from '@chainsentinel/types';

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    @InjectRepository(WatchlistEntry) private watchlistRepo: Repository<WatchlistEntry>,
  ) {}

  async add(data: {
    walletAddress: string;
    blockchain: BlockchainType;
    caseId?: string;
    reason: string;
    sensitivity?: WatchlistSensitivity;
    createdBy: string;
  }): Promise<WatchlistEntry> {
    const entry = this.watchlistRepo.create({
      ...data,
      isActive: true,
    });
    return this.watchlistRepo.save(entry);
  }

  async remove(id: string): Promise<void> {
    await this.watchlistRepo.update(id, { isActive: false });
  }

  async findAll(options?: { page?: number; limit?: number; activeOnly?: boolean }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const qb = this.watchlistRepo.createQueryBuilder('w')
      .orderBy('w.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.activeOnly !== false) {
      qb.andWhere('w.is_active = true');
    }

    const [entries, total] = await qb.getManyAndCount();
    return { data: entries, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getActiveWatchlistAddresses(): Promise<string[]> {
    const entries = await this.watchlistRepo.find({
      where: { isActive: true },
      select: ['walletAddress'],
    });
    return entries.map((e) => e.walletAddress);
  }

  async getCount(): Promise<number> {
    return this.watchlistRepo.count({ where: { isActive: true } });
  }
}
