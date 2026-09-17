import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  VerificationSource,
  VerificationResult,
  VerificationStatus,
  HistoricalBalance,
  ProducerMetadata,
} from '@chainsentinel/types';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { VerificationSource as VerificationSourceEntity } from './verification-source.entity';

/**
 * Independent Verification layer (RULES §0.2, §1 / CONDITIONS 1.1-1.9).
 *
 * The API is a source, not the proof. Critical facts are cross-checked against an
 * own-node-style primary source and at least one independent source:
 *   - both agree            => verified
 *   - only one source       => unverified (not usable in high-confidence evidence)
 *   - both present, differ  => conflict (manual reconciliation, never auto-resolved)
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(VerificationSourceEntity) private sourceRepo: Repository<VerificationSourceEntity>,
    private configService: ConfigService,
  ) {}

  /** Configured sources for a chain: own node + independent RPCs from env/DB, mock-safe */
  async getSources(chain: string): Promise<VerificationSourceEntity[]> {
    const seeded = await this.sourceRepo.find({ where: { chain, isActive: true }, order: { priority: 'ASC' } });
    if (seeded.length > 0) return seeded;

    // Env fallback so the service works on a fresh database (CONDITION 1.8 failover sources)
    const sources: Partial<VerificationSourceEntity>[] = [];
    const trongrid = this.configService.get('TRONGRID_API_KEY');
    if (trongrid) {
      sources.push({ chain, name: 'trongrid', kind: 'independent_rpc', endpoint: 'https://api.trongrid.io', priority: 1 });
    }
    const etherscan = this.configService.get('ETHERSCAN_API_KEY');
    if (etherscan) {
      sources.push({ chain, name: 'etherscan', kind: 'independent_rpc', endpoint: 'https://api.etherscan.io', priority: 1 });
    }
    const alchemy = this.configService.get('ALCHEMY_API_KEY');
    if (alchemy) {
      sources.push({ name: 'alchemy', chain, kind: 'independent_rpc', endpoint: 'https://eth-mainnet.g.alchemy.com/v2', priority: 2 });
    }
    sources.push({ chain, name: 'local_index', kind: 'indexer', endpoint: null, priority: 10 });
    return this.sourceRepo.create(sources as VerificationSourceEntity[]);
  }

  /**
   * Cross-check a critical transaction fact between the primary source and independent sources.
   * Dual-source agreement => VERIFIED; single source => UNVERIFIED; disagreement => CONFLICT.
   */
  async crossCheckTransaction(
    txHash: string,
    primary: { name: string; kind: VerificationSource['kind']; data: Record<string, unknown> },
    independents: Array<{ name: string; kind: VerificationSource['kind']; data: Record<string, unknown> | null }>,
    criticalFields: string[] = ['from', 'to', 'amount', 'blockNumber'],
  ): Promise<VerificationResult> {
    const sources: VerificationSource[] = [
      {
        name: primary.name,
        kind: primary.kind,
        agreed: true,
        collectedAt: new Date().toISOString(),
        detail: 'primary source of record',
      },
    ];

    let independentAgree = 0;
    let independentDisagree = 0;

    for (const ind of independents) {
      if (!ind.data) {
        sources.push({ name: ind.name, kind: ind.kind, agreed: false, collectedAt: new Date().toISOString(), detail: 'source unreachable' });
        continue;
      }
      const disagreements = criticalFields.filter((f) => {
        const a = (primary.data as any)[f];
        const b = (ind.data as any)[f];
        if (a === undefined || b === undefined) return false; // field absent is not a disagreement
        return String(a).toLowerCase() !== String(b).toLowerCase();
      });
      const agreed = disagreements.length === 0;
      if (agreed) independentAgree++;
      else independentDisagree++;
      sources.push({
        name: ind.name,
        kind: ind.kind,
        agreed,
        collectedAt: new Date().toISOString(),
        detail: agreed ? 'agrees with primary' : `differs on: ${disagreements.join(', ')}`,
      });
    }

    let status: VerificationStatus;
    if (independentDisagree > 0) {
      status = VerificationStatus.CONFLICT; // CONDITION 1.3 — flag for manual reconciliation
    } else if (independentAgree > 0) {
      status = VerificationStatus.VERIFIED; // CONDITION 1.2 — own node + independent agree
    } else {
      status = VerificationStatus.UNVERIFIED; // CONDITION 1.1 — single source only
    }

    return { status, sources, checkedAt: new Date().toISOString() };
  }

  /**
   * Persist verification outcome on a stored transaction and tag it with source/collection metadata.
   */
  async applyVerification(
    txId: string,
    result: VerificationResult,
    meta?: { dataSource?: string; collectedAt?: Date; syncState?: string },
  ): Promise<void> {
    await this.txRepo.update(txId, {
      verificationStatus: result.status,
      verificationSources: result.sources as any,
      ...(meta?.dataSource ? { dataSource: meta.dataSource } : {}),
      ...(meta?.collectedAt ? { collectedAt: meta.collectedAt } : {}),
      ...(meta?.syncState ? { syncState: meta.syncState } : {}),
    });
  }

  /**
   * CONDITION 1.5 — reorg detected: all transactions in affected blocks must be revalidated
   * before reuse in evidence or graph. Marks them stale until the check has run.
   */
  async revalidateBlocks(blockNumbers: number[], chain: string): Promise<{ revalidated: number }> {
    const txs = await this.txRepo
      .createQueryBuilder('t')
      .where('t.chain = :chain', { chain })
      .andWhere('t.blockNumber IN (:...blockNumbers)', { blockNumbers })
      .getMany();

    for (const tx of txs) {
      // After a reorg, previously verified facts must be re-established from sources
      await this.txRepo.update(tx.id, {
        verificationStatus: VerificationStatus.UNVERIFIED,
        reorgCheckedAt: new Date(),
        syncState: 'REVALIDATED_AFTER_REORG',
      });
    }
    this.logger.warn(`Reorg revalidation applied to ${txs.length} transaction(s) in blocks ${blockNumbers.join(', ')} on ${chain}`);
    return { revalidated: txs.length };
  }

  /**
   * Block-anchored historical balance (RULES §1): a bare "current balance" is rejected —
   * the claim must be anchored to a specific block and carry the transfers explaining changes.
   */
  buildHistoricalBalance(params: {
    address: string;
    chain: string;
    asset: string;
    amount: string;
    blockNumber: number;
    blockHash: string | null;
    supportingTxs: Array<{ txHash: string }>;
    verification: VerificationResult;
  }): HistoricalBalance {
    if (!params.blockNumber || params.blockNumber <= 0) {
      throw new Error('Historical balance requires a specific block reference — current balance alone is insufficient');
    }
    if (!params.supportingTxs || params.supportingTxs.length === 0) {
      throw new Error('Historical balance requires supporting transactions explaining the state');
    }
    return {
      address: params.address,
      chain: params.chain as any,
      asset: params.asset,
      amount: params.amount,
      blockNumber: params.blockNumber,
      blockHash: params.blockHash,
      queriedAt: new Date().toISOString(),
      supportingTransactions: params.supportingTxs.map((t) => t.txHash),
      verification: params.verification,
    };
  }

  /** Producer metadata tagging helper (RULES §2) — safe defaults when chain data lacks it */
  static emptyProducerMetadata(): ProducerMetadata {
    return { producerAddress: null, producerType: null, consensusMetadata: null };
  }
}
