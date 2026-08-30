import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investigation } from '../../database/entities/investigation.entity';
import { InvestigationJob } from '../../database/entities/investigation-job.entity';
import { InvestigationStatus, InvestigationStage } from '@chainsentinel/types';

@Injectable()
export class InvestigationsService {
  private readonly logger = new Logger(InvestigationsService.name);

  constructor(
    @InjectRepository(Investigation) private invRepo: Repository<Investigation>,
    @InjectRepository(InvestigationJob) private jobRepo: Repository<InvestigationJob>,
  ) {}

  async create(data: { caseId: string; suspectWallet: string; blockchain?: string }): Promise<Investigation> {
    const investigation = this.invRepo.create({
      caseId: data.caseId,
      suspectWallet: data.suspectWallet,
      blockchain: (data.blockchain as any) || null,
      status: InvestigationStatus.QUEUED,
      currentStage: InvestigationStage.INVESTIGATION_REQUESTED,
      progress: 0,
      message: 'Investigation queued',
    });

    const saved = await this.invRepo.save(investigation);
    this.logger.log(`Investigation ${saved.id} created for case ${data.caseId}`);

    // Create initial job for the first stage
    await this.jobRepo.save({
      investigationId: saved.id,
      stage: InvestigationStage.INVESTIGATION_REQUESTED,
      status: 'PENDING',
      progress: 0,
      message: 'Waiting to start',
    });

    return saved;
  }

  async findById(id: string): Promise<Investigation> {
    const inv = await this.invRepo.findOne({
      where: { id },
      relations: ['jobs', 'case'],
    });
    if (!inv) throw new NotFoundException('Investigation not found');
    return inv;
  }

  async findByCaseId(caseId: string): Promise<Investigation[]> {
    return this.invRepo.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
      relations: ['jobs'],
    });
  }

  async updateProgress(
    id: string,
    stage: InvestigationStage,
    progress: number,
    message: string,
    stats?: Record<string, unknown>,
  ): Promise<void> {
    await this.invRepo.update(id, {
      currentStage: stage,
      progress,
      message,
      status: InvestigationStatus.RUNNING,
      stats: (stats || undefined) as any,
      startedAt: new Date(),
    });

    // Create or update job for this stage
    let job = await this.jobRepo.findOne({
      where: { investigationId: id, stage },
    });

    if (job) {
      await this.jobRepo.update(job.id, {
        status: 'RUNNING',
        progress,
        message,
        startedAt: job.startedAt || new Date(),
      });
    } else {
      job = this.jobRepo.create({
        investigationId: id,
        stage,
        status: 'RUNNING',
        progress,
        message,
        startedAt: new Date(),
      });
      await this.jobRepo.save(job);
    }
  }

  async completeStage(id: string, stage: InvestigationStage): Promise<void> {
    await this.jobRepo.update(
      { investigationId: id, stage },
      { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    );
  }

  async completeInvestigation(id: string, stats: Record<string, unknown>): Promise<void> {
    await this.invRepo.update(id, {
      status: InvestigationStatus.COMPLETED,
      currentStage: InvestigationStage.INVESTIGATION_COMPLETED,
      progress: 100,
      message: 'Investigation completed',
      completedAt: new Date(),
      stats: stats as any,
    });
  }

  async failInvestigation(id: string, reason: string): Promise<void> {
    await this.invRepo.update(id, {
      status: InvestigationStatus.FAILED,
      failureReason: reason,
      message: `Failed: ${reason}`,
    });
  }

  async getJobs(investigationId: string): Promise<InvestigationJob[]> {
    return this.jobRepo.find({
      where: { investigationId },
      order: { createdAt: 'ASC' },
    });
  }

  async getAll(organizationId: string, options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const [investigations, total] = await this.invRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.case', 'c')
      .where('c.organizationId = :organizationId', { organizationId })
      .orderBy('i.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: investigations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats(organizationId: string) {
    const qb = this.invRepo.createQueryBuilder('i')
      .innerJoin('i.case', 'c')
      .where('c.organizationId = :organizationId', { organizationId });

    const total = await qb.getCount();
    const running = await qb.clone().andWhere('i.status = :status', { status: InvestigationStatus.RUNNING }).getCount();
    const completed = await qb.clone().andWhere('i.status = :status', { status: InvestigationStatus.COMPLETED }).getCount();
    const failed = await qb.clone().andWhere('i.status = :status', { status: InvestigationStatus.FAILED }).getCount();

    return { total, running, completed, failed };
  }
}
