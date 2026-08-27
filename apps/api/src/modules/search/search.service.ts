import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Case } from '../../database/entities/case.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { SearchResult } from '@chainsentinel/types';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
  ) {}

  async search(query: string, type?: string, limit: number = 20, organizationId?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const q = `%${query}%`;

    if (!type || type === 'wallet') {
      const wallets = await this.walletRepo.find({
        where: [
          { address: Like(q) },
          { label: Like(q) },
          { entityLabel: Like(q) },
        ],
        take: limit,
      });
      wallets.forEach((w) => results.push({
        type: 'wallet',
        id: w.id,
        title: w.label || w.entityLabel || w.address.substring(0, 12) + '...',
        subtitle: `${w.blockchain} - Risk: ${w.riskLevel}`,
        url: `/wallets/${w.address}`,
      }));
    }

    if (!type || type === 'case') {
      const qb = this.caseRepo.createQueryBuilder('c');
      if (organizationId) {
        qb.where('c.organization_id = :orgId', { orgId: organizationId });
      }
      const cases = await qb
        .andWhere('(c.case_number ILIKE :q OR c.title ILIKE :q)', { q })
        .take(limit)
        .getMany();
      cases.forEach((c) => results.push({
        type: 'case',
        id: c.id,
        title: c.caseNumber,
        subtitle: `${c.title} - ${c.status}`,
        url: `/cases/${c.id}`,
      }));
    }

    if (!type || type === 'vasp') {
      const vasps = await this.vaspRepo.find({
        where: { name: Like(q) },
        take: limit,
      });
      vasps.forEach((v) => results.push({
        type: 'vasp',
        id: v.id,
        title: v.name,
        subtitle: `${v.type} - ${v.jurisdiction || 'Unknown'}`,
        url: `/vasp/${v.id}`,
      }));
    }

    if (!type || type === 'transaction') {
      const txs = await this.txRepo.find({
        where: { txHash: Like(q) },
        take: limit,
      });
      txs.forEach((tx) => results.push({
        type: 'transaction',
        id: tx.id,
        title: tx.txHash.substring(0, 16) + '...',
        subtitle: `${tx.chain} - ${tx.amountNormalized} ${tx.asset}`,
        url: `/transactions/${tx.txHash}`,
      }));
    }

    return results.slice(0, limit);
  }
}
