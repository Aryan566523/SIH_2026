import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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
    const trimmed = (query || '').trim();
    if (!trimmed) return [];
    const q = `%${trimmed}%`;
    const take = Number(limit) || 20;

    if (!type || type === 'wallet') {
      const wallets = await this.walletRepo.find({
        where: [
          { address: ILike(q) },
          { label: ILike(q) },
          { entityLabel: ILike(q) },
        ],
        take,
      });

      wallets.forEach((w) => results.push({
        type: 'wallet',
        id: w.id,
        title: w.label || w.entityLabel || `${w.address.substring(0, 8)}...${w.address.slice(-6)}`,
        subtitle: `${w.blockchain} â€¢ Risk: ${w.riskLevel} (${w.riskScore || 0}/100)`,
        url: `/dashboard/wallets/${w.address}`,
      }));

      // If no wallet in DB and query looks like a crypto address, provide immediate interactive link
      if (wallets.length === 0 && (
        /^0x[a-fA-F0-9]{20,}/.test(query.trim()) ||
        /^T[a-zA-Z0-9]{20,}/.test(query.trim()) ||
        /^(1|3|bc1)[a-km-zA-HJ-NP-Z0-9]{20,}/i.test(query.trim())
      )) {
        const addr = query.trim();
        const chain = addr.startsWith('T') ? 'TRON' : (addr.startsWith('1') || addr.startsWith('3') || addr.startsWith('bc1')) ? 'BITCOIN' : 'ETHEREUM';
        results.push({
          type: 'wallet',
          id: addr,
          title: `Inspect ${chain} Address: ${addr.substring(0, 8)}...${addr.slice(-6)}`,
          subtitle: `Live ${chain} Blockchain Analysis & Intelligence`,
          url: `/dashboard/wallets/${addr}`,
        });
      }
    }

    if (!type || type === 'case') {
      const qb = this.caseRepo.createQueryBuilder('c')
        .where('(c.case_number ILIKE :q OR c.title ILIKE :q)', { q });
      if (organizationId) {
        qb.andWhere('c.organization_id = :orgId', { orgId: organizationId });
      }
      const cases = await qb
        .take(take)
        .getMany()
        .catch(() => []);
      cases.forEach((c) => results.push({
        type: 'case',
        id: c.id,
        title: c.caseNumber,
        subtitle: `${c.title} â€¢ ${c.status}`,
        url: `/dashboard/investigations`,
      }));
    }

    if (!type || type === 'vasp') {
      const vasps = await this.vaspRepo.find({
        where: { name: ILike(q) },
        take,
      });
      vasps.forEach((v) => results.push({
        type: 'vasp',
        id: v.id,
        title: v.name,
        subtitle: `${v.type} â€¢ ${v.jurisdiction || 'Global'}`,
        url: `/dashboard/vasp`,
      }));
    }

    if (!type || type === 'transaction') {
      const txs = await this.txRepo.find({
        where: { txHash: ILike(q) },
        take,
      });
      txs.forEach((tx) => results.push({
        type: 'transaction',
        id: tx.id,
        title: tx.txHash.substring(0, 16) + '...',
        subtitle: `${tx.chain} â€¢ ${tx.amountNormalized} ${tx.asset}`,
        url: `/dashboard/graph?address=${tx.from}`,
      }));
    }

    return results.slice(0, take);
  }
}
