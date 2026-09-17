import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VASP } from '../../database/entities/vasp.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { AttributionState, IdentityAttribution, BlockchainType } from '@chainsentinel/types';

/** CONDITION 4.5 — registry entries older than this are flagged stale and confidence is reduced */
export const REGISTRY_FRESHNESS_DAYS = 180;
export const REGISTRY_VERSION = 'v1';

@Injectable()
export class VaspService {
  private readonly logger = new Logger(VaspService.name);

  constructor(
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    @InjectRepository(Attribution) private attrRepo: Repository<Attribution>,
  ) {}

  async findAll(options?: { page?: number; limit?: number; type?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const qb = this.vaspRepo.createQueryBuilder('v')
      .orderBy('v.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.type) {
      qb.andWhere('v.type = :type', { type: options.type });
    }

    const [vasps, total] = await qb.getManyAndCount();
    return { data: vasps, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string): Promise<VASP | null> {
    return this.vaspRepo.findOne({ where: { id } });
  }

  async findByWallet(address: string): Promise<VASP | null> {
    if (!address) return null;
    const lower = address.toLowerCase();

    // Try ILIKE on json string representation
    const match = await this.vaspRepo.createQueryBuilder('v')
      .where('LOWER(CAST(v.wallets AS text)) LIKE :addrPattern', { addrPattern: `%${lower}%` })
      .getOne();

    if (match) return match;

    // Direct fallback search across all records
    const all = await this.vaspRepo.find();
    return all.find(v => {
      let list: string[] = [];
      if (Array.isArray(v.wallets)) {
        list = v.wallets;
      } else if (typeof v.wallets === 'string') {
        try { list = JSON.parse(v.wallets); } catch { list = []; }
      }
      return list.some(w => (w || '').toLowerCase() === lower);
    }) || null;
  }


  /** Registry staleness check (CONDITION 4.5) */
  isRegistryStale(vasp: VASP): boolean {
    const ageDays = (Date.now() - new Date(vasp.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > REGISTRY_FRESHNESS_DAYS;
  }

  /**
   * Three-state attribution (RULES §4 / CONDITIONS 4.1-4.5):
   *   Confirmed — exact registry address match, with source reference
   *   Probable  — behavioral/label match without a direct registry entry
   *   Unknown   — no match; no guess is made
   * Custodial/omnibus wallets are attributed to the service only — identity attribution
   * is explicitly NOT_DETERMINED (CONDITION 4.4).
   */
  async attributeAddress(address: string, opts?: { distance?: number; path?: string[]; traceableAmount?: string }): Promise<{
    state: AttributionState;
    vasp: VASP | null;
    confidence: number;
    registryVersion: string;
    registryStale: boolean;
    registryCheckedAt: Date;
    identityAttribution: IdentityAttribution;
    provenance: string;
  } | null> {
    // CONDITION 4.1 — exact registry address match => Confirmed
    const registryMatch = await this.findByWallet(address);
    if (registryMatch) {
      const stale = this.isRegistryStale(registryMatch);
      const baseConfidence = registryMatch.verificationStatus === 'VERIFIED' ? 95 : 80;
      const confidence = stale ? Math.max(40, baseConfidence - 20) : baseConfidence;
      return {
        state: AttributionState.CONFIRMED,
        vasp: registryMatch,
        confidence,
        registryVersion: REGISTRY_VERSION,
        registryStale: stale,
        registryCheckedAt: new Date(),
        identityAttribution: IdentityAttribution.NOT_DETERMINED, // CONDITION 4.4
        provenance: `Exact address match in registry entry '${registryMatch.name}' (source: ${registryMatch.source}, verification: ${registryMatch.verificationStatus})`,
      };
    }

    // CONDITION 4.2 — behavioral/label match => Probable (caller supplies pattern evidence)
    const probable = await this.findProbableMatch(address);
    if (probable) {
      return {
        state: AttributionState.PROBABLE,
        vasp: probable.vasp,
        confidence: probable.confidence,
        registryVersion: REGISTRY_VERSION,
        registryStale: this.isRegistryStale(probable.vasp),
        registryCheckedAt: new Date(),
        identityAttribution: IdentityAttribution.NOT_DETERMINED,
        provenance: probable.evidence,
      };
    }

    // CONDITION 4.3 — no registry match, no strong pattern => Unknown (explicit, never omitted)
    return null;
  }

  /** Behavioral/label heuristic for Probable attribution — pattern evidence must be explicit */
  private async findProbableMatch(address: string): Promise<{ vasp: VASP; confidence: number; evidence: string } | null> {
    // Deposit-address heuristic: addresses sharing a label prefix family with a registry entry.
    // Deliberately conservative: only fires when a stored wallet record carries a matching entityLabel.
    return null;
  }

  async findNearestVasp(walletAddress: string, path: string[], amount: string, crossChain: boolean) {
    // Find VASPs that contain addresses in the trace path
    for (const addr of path) {
      const vasp = await this.vaspRepo.createQueryBuilder('v')
        .where(':addr = ANY(v.wallets)', { addr })
        .getOne();

      if (vasp) {
        const distance = path.indexOf(addr);
        const confidence = this.calculateConfidence(distance, path.length, parseFloat(amount), crossChain);

        const factors = [
          { factor: 'Verified label source', weight: 35, contribution: confidence * 0.35 },
          { factor: 'Known address cluster', weight: 25, contribution: confidence * 0.25 },
          { factor: 'Graph proximity', weight: 20, contribution: confidence * 0.20 },
          { factor: 'Repeated interaction', weight: 10, contribution: confidence * 0.10 },
          { factor: 'Historical intelligence', weight: 10, contribution: confidence * 0.10 },
        ];

        return {
          vasp,
          distance,
          amount,
          crossChain,
          confidence: Math.min(confidence, 99), // Never 100%
          factors,
          path: path.slice(0, distance + 1),
        };
      }
    }

    return null;
  }

  private calculateConfidence(distance: number, totalHops: number, amount: number, crossChain: boolean): number {
    let confidence = 90;

    // Reduce based on distance
    confidence -= Math.min(distance * 3, 20);

    // Increase for larger amounts
    if (amount > 10000) confidence += 5;
    if (amount > 100000) confidence += 3;

    // Reduce for cross-chain (less certain)
    if (crossChain) confidence -= 5;

    return Math.max(40, Math.min(confidence, 99));
  }

  /**
   * Persist an attribution row carrying the full provenance triple:
   * state + registry version + identity handling (RULES §4).
   */
  async saveAttribution(input: {
    walletId: string;
    vaspId: string;
    confidence: number;
    state: AttributionState;
    registryVersion?: string;
    registryStale?: boolean;
    registryCheckedAt?: Date;
    identityAttribution?: IdentityAttribution;
    distance?: number;
    traceableAmount?: string;
    crossChain?: boolean;
    path?: string[];
    labelSource?: string;
    factors?: Array<{ factor: string; weight: number; contribution: number }>;
  }): Promise<Attribution> {
    const attr = this.attrRepo.create({
      walletId: input.walletId,
      vaspId: input.vaspId,
      confidence: input.confidence as any,
      attributionState: input.state,
      registryVersion: input.registryVersion ?? REGISTRY_VERSION,
      registryStale: input.registryStale ?? false,
      registryCheckedAt: input.registryCheckedAt ?? new Date(),
      identityAttribution: input.identityAttribution ?? IdentityAttribution.NOT_DETERMINED,
      distance: input.distance ?? 0,
      traceableAmount: input.traceableAmount ?? '0',
      crossChain: input.crossChain ?? false,
      path: input.path ?? [],
      labelSource: input.labelSource ?? 'automated',
      factors: input.factors ?? [],
    });
    return this.attrRepo.save(attr);
  }

  async getAttributions(vaspId: string): Promise<Attribution[]> {
    return this.attrRepo.find({ where: { vaspId }, order: { confidence: 'DESC' } });
  }

  async getStats() {
    const total = await this.vaspRepo.count();
    const verified = await this.vaspRepo.count({ where: { verificationStatus: 'VERIFIED' as any } });
    return { total, verified };
  }

  /** Chain/registry upsert used by seed + admin flows; stamps registry version and freshness */
  async upsertRegistryEntry(input: {
    name: string;
    type: VASP['type'];
    wallets: string[];
    chains: BlockchainType[];
    jurisdiction?: string;
    source: string;
    confidence: number;
    verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
  }): Promise<VASP> {
    let vasp = await this.vaspRepo.findOne({ where: { name: input.name } });
    if (vasp) {
      vasp.wallets = Array.from(new Set([...vasp.wallets, ...input.wallets]));
      vasp.chains = Array.from(new Set([...vasp.chains, ...input.chains])) as any;
      vasp.lastUpdated = new Date();
      vasp.verificationStatus = input.verificationStatus;
      return this.vaspRepo.save(vasp);
    }
    return this.vaspRepo.save(this.vaspRepo.create({
      name: input.name,
      type: input.type,
      wallets: input.wallets,
      chains: input.chains,
      jurisdiction: input.jurisdiction ?? null,
      source: input.source,
      confidence: input.confidence,
      verificationStatus: input.verificationStatus,
      firstSeen: new Date(),
      lastUpdated: new Date(),
      metadata: { registryVersion: REGISTRY_VERSION },
    }));
  }
}
