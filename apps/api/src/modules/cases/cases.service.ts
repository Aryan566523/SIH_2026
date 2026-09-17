import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../../database/entities/case.entity';
import { Complaint } from '../../database/entities/complaint.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { CaseStatus, FraudType, RiskLevel, BlockchainType } from '@chainsentinel/types';

/**
 * Chain-specific address format validation (CONDITIONS §1 intake):
 * a wallet that fails chain-specific format validation is rejected with a clear error —
 * never silently processed.
 */
export const CHAIN_ADDRESS_PATTERNS: Record<string, RegExp> = {
  ETHEREUM: /^0x[0-9a-fA-F]{40}$/,
  POLYGON: /^0x[0-9a-fA-F]{40}$/,
  BNB_CHAIN: /^0x[0-9a-fA-F]{40}$/,
  ARBITRUM: /^0x[0-9a-fA-F]{40}$/,
  OPTIMISM: /^0x[0-9a-fA-F]{40}$/,
  TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  BITCOIN: /^(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}$|^bc1[0-9a-z]{25,90}$/i,
};

export function detectChainFromAddress(address: string): BlockchainType | null {
  for (const [chain, pattern] of Object.entries(CHAIN_ADDRESS_PATTERNS)) {
    if (pattern.test(address)) return chain as BlockchainType;
  }
  return null;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Complaint) private complaintsRepo: Repository<Complaint>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
  ) {}

  async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.casesRepo.count();
    const num = (count + 1).toString().padStart(6, '0');
    return `NCRP-${year}-${num}`;
  }

  async create(data: {
    title: string;
    fraudType: FraudType;
    description?: string;
    complaint?: {
      suspectWalletAddress: string;
      blockchain?: string;
      cryptocurrency?: string;
      estimatedFraudAmount?: string;
      victimReference?: string;
      reportedTimestamp?: string;
      description?: string;
    };
    organizationId: string;
    createdBy: string;
  }): Promise<Case> {
    // ---- Intake condition 1: chain-specific wallet format validation ----
    let detectedChain: BlockchainType | null = null;
    if (data.complaint?.suspectWalletAddress) {
      const addr = data.complaint.suspectWalletAddress.trim();
      detectedChain = detectChainFromAddress(addr);
      if (!detectedChain) {
        throw new BadRequestException(
          `Wallet address '${addr}' does not match any supported chain address format (TRON, Ethereum/EVM, Bitcoin). Case rejected — please verify the address with the complainant.`,
        );
      }
      // If the reporter claims a chain, the address format must agree
      if (data.complaint.blockchain && data.complaint.blockchain !== 'UNKNOWN') {
        const claimed = data.complaint.blockchain as string;
        const claimedPattern = CHAIN_ADDRESS_PATTERNS[claimed];
        if (claimedPattern && !claimedPattern.test(addr)) {
          throw new BadRequestException(
            `Address format does not match claimed chain ${claimed}. Detected format: ${detectedChain}.`,
          );
        }
      }
    }

    // ---- Intake condition 2: duplicate wallet in open cases => link, don't run redundant work ----
    let relatedCaseId: string | null = null;
    if (data.complaint?.suspectWalletAddress && detectedChain) {
      const duplicate = await this.complaintsRepo
        .createQueryBuilder('cmp')
        .innerJoin(Case, 'c', 'c.id = cmp.caseId')
        .where('LOWER(cmp.suspectWalletAddress) = LOWER(:addr)', { addr: data.complaint.suspectWalletAddress.trim() })
        .andWhere('c.status IN (:...openStatuses)', { openStatuses: [CaseStatus.ACTIVE, CaseStatus.MONITORING, CaseStatus.UNDER_REVIEW, CaseStatus.ESCALATED] })
        .getOne();
      if (duplicate) {
        relatedCaseId = duplicate.caseId;
        this.logger.warn(`Duplicate suspect wallet detected: linked new case to existing case ${duplicate.caseId}`);
      }
    }

    const caseNumber = await this.generateCaseNumber();

    const caseEntity = this.casesRepo.create({
      caseNumber,
      title: data.title,
      fraudType: data.fraudType,
      description: data.description || null,
      status: CaseStatus.ACTIVE,
      riskLevel: RiskLevel.LOW,
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      assignedInvestigatorId: data.createdBy,
      relatedCaseId,
    });

    const savedCase = await this.casesRepo.save(caseEntity);

    if (data.complaint) {
      const complaint = this.complaintsRepo.create({
        caseId: savedCase.id,
        complaintNumber: `CMP-${caseNumber}`,
        suspectWalletAddress: data.complaint.suspectWalletAddress.trim(),
        blockchain: detectedChain || (data.complaint.blockchain as any) || 'UNKNOWN',
        cryptocurrency: data.complaint.cryptocurrency || 'USDT',
        estimatedFraudAmount: data.complaint.estimatedFraudAmount || null,
        victimReference: data.complaint.victimReference || null,
        reportedTimestamp: data.complaint.reportedTimestamp ? new Date(data.complaint.reportedTimestamp) : new Date(),
        description: data.complaint.description || null,
      });
      await this.complaintsRepo.save(complaint);

      // ---- Intake condition 3: claimed loss vs on-chain transfers ----
      // Unsubstantiated => flagged for review, NOT auto-rejected.
      if (data.complaint.estimatedFraudAmount && detectedChain) {
        savedCase.lossUnsubstantiated = !(await this.isLossSubstantiated(
          data.complaint.suspectWalletAddress.trim(),
          detectedChain,
          data.complaint.estimatedFraudAmount,
        ));
        if (savedCase.lossUnsubstantiated) {
          this.logger.warn(`Case ${caseNumber}: claimed loss not matched by indexed transfers — flagged unsubstantiated, pending review`);
          await this.casesRepo.update(savedCase.id, { lossUnsubstantiated: true });
        }
      }
    }

    this.logger.log(`Case ${caseNumber} created by ${data.createdBy}${relatedCaseId ? ` (linked to case ${relatedCaseId})` : ''}`);
    return savedCase;
  }

  /**
   * A claimed loss is substantiated when at least one indexed transfer to/from the wallet
   * is of the same order as the claim (>= 50% of claimed amount). When the local index has
   * no data for the wallet yet, the case is NOT flagged (unknown ≠ unsubstantiated).
   */
  async isLossSubstantiated(address: string, chain: BlockchainType, claimedAmount: string): Promise<boolean> {
    const claimed = parseFloat(claimedAmount);
    if (!Number.isFinite(claimed) || claimed <= 0) return true; // nothing claimable to contradict

    const txs = await this.txRepo.find({
      where: [{ from: address, chain }, { to: address, chain }],
    });
    if (txs.length === 0) return true; // no indexed data — cannot call it unsubstantiated

    const maxObserved = Math.max(...txs.map((t) => parseFloat(t.amountNormalized) || 0));
    return maxObserved >= claimed * 0.5;
  }

  async findById(id: string): Promise<Case> {
    const c = await this.casesRepo.findOne({
      where: { id },
      relations: ['complaints', 'assignedInvestigator', 'supervisor'],
    });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  async findByCaseNumber(caseNumber: string): Promise<Case> {
    const c = await this.casesRepo.findOne({
      where: { caseNumber },
      relations: ['complaints'],
    });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  async findAll(organizationId: string, options?: { page?: number; limit?: number; status?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const qb = this.casesRepo.createQueryBuilder('c')
      .where('c.organization_id = :organizationId', { organizationId })
      .orderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.status) {
      qb.andWhere('c.status = :status', { status: options.status });
    }

    const [cases, total] = await qb.getManyAndCount();

    return {
      data: cases,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(id: string, status: CaseStatus): Promise<Case> {
    await this.casesRepo.update(id, { status });
    return this.findById(id);
  }

  async getComplaints(caseId: string) {
    return this.complaintsRepo.find({ where: { caseId }, order: { createdAt: 'DESC' } });
  }

  async getStats(organizationId: string) {
    const total = await this.casesRepo.count({ where: { organizationId } });
    const active = await this.casesRepo.count({ where: { organizationId, status: CaseStatus.ACTIVE } });
    const monitoring = await this.casesRepo.count({ where: { organizationId, status: CaseStatus.MONITORING } });
    const escalated = await this.casesRepo.count({ where: { organizationId, status: CaseStatus.ESCALATED } });
    const closed = await this.casesRepo.count({ where: { organizationId, status: CaseStatus.CLOSED } });

    return { total, active, monitoring, escalated, closed };
  }
}
