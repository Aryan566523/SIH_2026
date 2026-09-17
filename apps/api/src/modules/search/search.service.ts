import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Case } from '../../database/entities/case.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Investigation } from '../../database/entities/investigation.entity';
import { Alert } from '../../database/entities/alert.entity';
import { Report } from '../../database/entities/report.entity';
import { SearchResult } from '@chainsentinel/types';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(Investigation) private invRepo: Repository<Investigation>,
    @InjectRepository(Alert) private alertRepo: Repository<Alert>,
    @InjectRepository(Report) private reportRepo: Repository<Report>,
  ) {}

  async search(query: string, type?: string, limit: number = 20, organizationId?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const trimmed = (query || '').trim();
    if (!trimmed) return [];
    const q = `%${trimmed}%`;
    const take = Math.min(Number(limit) || 20, 50);

    // ── WALLETS ──────────────────────────────────────────────────────────────
    if (!type || type === 'wallet') {
      const wallets = await this.walletRepo.find({
        where: [
          { address: ILike(q) },
          { label: ILike(q) },
          { entityLabel: ILike(q) },
        ],
        take,
      });

      // Exact-match addresses go first (highest relevance)
      const exactWallets = wallets.filter(w => w.address.toLowerCase() === trimmed.toLowerCase());
      const fuzzyWallets = wallets.filter(w => w.address.toLowerCase() !== trimmed.toLowerCase());
      const sortedWallets = [...exactWallets, ...fuzzyWallets];

      sortedWallets.forEach((w) => results.push({
        type: 'wallet',
        id: w.id,
        title: w.label || w.entityLabel || `${w.address.substring(0, 8)}...${w.address.slice(-6)}`,
        subtitle: `${w.blockchain} • Risk: ${w.riskLevel || 'UNKNOWN'} (${w.riskScore || 0}/100)`,
        url: `/dashboard/wallets/${w.address}`,
      }));

      // If no wallet in DB and query looks like a crypto address, provide immediate interactive link
      if (wallets.length === 0 && (
        /^0x[a-fA-F0-9]{20,}/.test(trimmed) ||
        /^T[a-zA-Z0-9]{20,}/.test(trimmed) ||
        /^(1|3|bc1)[a-km-zA-HJ-NP-Z0-9]{20,}/i.test(trimmed)
      )) {
        const chain = trimmed.startsWith('T') ? 'TRON' : (trimmed.startsWith('1') || trimmed.startsWith('3') || trimmed.startsWith('bc1')) ? 'BITCOIN' : 'ETHEREUM';
        results.push({
          type: 'wallet',
          id: trimmed,
          title: `Inspect ${chain} Address: ${trimmed.substring(0, 8)}...${trimmed.slice(-6)}`,
          subtitle: `Live ${chain} Blockchain Analysis & Intelligence`,
          url: `/dashboard/wallets/${trimmed}`,
        });
      }
    }

    // ── CASES ─────────────────────────────────────────────────────────────────
    if (!type || type === 'case') {
      const qb = this.caseRepo.createQueryBuilder('c')
        .where('(c.case_number ILIKE :q OR c.title ILIKE :q OR c.description ILIKE :q)', { q });
      if (organizationId) qb.andWhere('c.organization_id = :orgId', { orgId: organizationId });
      const cases = await qb.take(take).getMany().catch(() => []);

      // Title prefix match goes first
      const exactCases = cases.filter(c => (c.caseNumber || '').toLowerCase().startsWith(trimmed.toLowerCase()));
      const restCases = cases.filter(c => !(c.caseNumber || '').toLowerCase().startsWith(trimmed.toLowerCase()));
      [...exactCases, ...restCases].forEach((c) => results.push({
        type: 'case',
        id: c.id,
        title: c.caseNumber,
        subtitle: `${c.title} • ${c.status}`,
        url: `/dashboard/investigations`,
      }));
    }

    // ── INVESTIGATIONS ────────────────────────────────────────────────────────
    if (!type || type === 'investigation') {
      const invs = await this.invRepo.createQueryBuilder('i')
        .where('(i.suspect_wallet ILIKE :q)', { q })
        .take(take)
        .getMany()
        .catch(() => []);
      invs.forEach((inv: any) => results.push({
        type: 'investigation' as any,
        id: inv.id,
        title: `Investigation: ${(inv.suspectWallet || '').substring(0, 10)}...`,
        subtitle: `Status: ${inv.status} • Stage: ${inv.currentStage || 'INIT'}`,
        url: `/dashboard/investigations/${inv.id}`,
      }));
    }

    // ── ALERTS ────────────────────────────────────────────────────────────────
    if (!type || type === 'alert') {
      const alertsFound = await this.alertRepo.createQueryBuilder('a')
        .where('(a.title ILIKE :q OR a.message ILIKE :q OR a.wallet_address ILIKE :q)', { q })
        .orderBy('a.created_at', 'DESC')
        .take(take)
        .getMany()
        .catch(() => []);

      // Title matches first
      const exactAlerts = alertsFound.filter(a => (a.title || '').toLowerCase().startsWith(trimmed.toLowerCase()));
      const restAlerts = alertsFound.filter(a => !(a.title || '').toLowerCase().startsWith(trimmed.toLowerCase()));
      [...exactAlerts, ...restAlerts].forEach((a: any) => results.push({
        type: 'alert' as any,
        id: a.id,
        title: a.title || 'Alert',
        subtitle: `${a.severity} • ${a.status} • ${a.walletAddress || ''}`,
        url: `/dashboard/alerts`,
      }));
    }

    // ── REPORTS ───────────────────────────────────────────────────────────────
    if (!type || type === 'report') {
      const reports = await this.reportRepo.createQueryBuilder('r')
        .where('(r.title ILIKE :q OR r.summary ILIKE :q)', { q })
        .orderBy('r.created_at', 'DESC')
        .take(take)
        .getMany()
        .catch(() => []);
      reports.forEach((r: any) => results.push({
        type: 'report' as any,
        id: r.id,
        title: r.title || 'Report',
        subtitle: r.summary ? r.summary.substring(0, 80) : 'Investigation Report',
        url: `/dashboard/reports`,
      }));
    }

    // ── VASPs ─────────────────────────────────────────────────────────────────
    if (!type || type === 'vasp') {
      const vasps = await this.vaspRepo.find({
        where: [{ name: ILike(q) }],
        take,
      });
      // Exact name prefix first
      const exactVasps = vasps.filter(v => v.name.toLowerCase().startsWith(trimmed.toLowerCase()));
      const restVasps = vasps.filter(v => !v.name.toLowerCase().startsWith(trimmed.toLowerCase()));
      [...exactVasps, ...restVasps].forEach((v) => results.push({
        type: 'vasp',
        id: v.id,
        title: v.name,
        subtitle: `${v.type} • ${v.jurisdiction || 'Global'}`,
        url: `/dashboard/vasp`,
      }));
    }

    // ── TRANSACTIONS ──────────────────────────────────────────────────────────
    if (!type || type === 'transaction') {
      const txs = await this.txRepo.find({
        where: { txHash: ILike(q) },
        take,
      });
      txs.forEach((tx) => results.push({
        type: 'transaction',
        id: tx.id,
        title: tx.txHash.substring(0, 18) + '...',
        subtitle: `${tx.chain} • ${tx.amountNormalized || '0'} ${tx.asset}`,
        url: `/dashboard/graph?address=${tx.from}`,
      }));
    }

    // Return sorted: title exact-prefix matches first across all types
    const prioritized = results.filter(r => r.title.toLowerCase().startsWith(trimmed.toLowerCase()));
    const rest = results.filter(r => !r.title.toLowerCase().startsWith(trimmed.toLowerCase()));
    return [...prioritized, ...rest].slice(0, take);
  }
}
