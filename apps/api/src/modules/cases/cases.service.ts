import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../../database/entities/case.entity';
import { Complaint } from '../../database/entities/complaint.entity';
import { CaseStatus, FraudType, RiskLevel } from '@chainsentinel/types';

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Complaint) private complaintsRepo: Repository<Complaint>,
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
    });

    const savedCase = await this.casesRepo.save(caseEntity);

    if (data.complaint) {
      const complaint = this.complaintsRepo.create({
        caseId: savedCase.id,
        complaintNumber: `CMP-${caseNumber}`,
        suspectWalletAddress: data.complaint.suspectWalletAddress,
        blockchain: (data.complaint.blockchain as any) || 'UNKNOWN',
        cryptocurrency: data.complaint.cryptocurrency || 'USDT',
        estimatedFraudAmount: data.complaint.estimatedFraudAmount || null,
        victimReference: data.complaint.victimReference || null,
        reportedTimestamp: data.complaint.reportedTimestamp ? new Date(data.complaint.reportedTimestamp) : new Date(),
        description: data.complaint.description || null,
      });
      await this.complaintsRepo.save(complaint);
    }

    this.logger.log(`Case ${caseNumber} created by ${data.createdBy}`);
    return savedCase;
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
