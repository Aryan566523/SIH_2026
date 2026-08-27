import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../../database/entities/alert.entity';
import { AlertSeverity, AlertStatus } from '@chainsentinel/types';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert) private alertRepo: Repository<Alert>,
  ) {}

  async create(data: {
    caseId?: string;
    walletAddress?: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Alert> {
    const alert = this.alertRepo.create({
      ...data,
      status: AlertStatus.UNREAD,
    });
    return this.alertRepo.save(alert);
  }

  async findAll(organizationId: string, options?: {
    page?: number;
    limit?: number;
    severity?: AlertSeverity;
    status?: AlertStatus;
    caseId?: string;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const qb = this.alertRepo.createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.severity) qb.andWhere('a.severity = :severity', { severity: options.severity });
    if (options?.status) qb.andWhere('a.status = :status', { status: options.status });
    if (options?.caseId) qb.andWhere('a.case_id = :caseId', { caseId: options.caseId });

    const [alerts, total] = await qb.getManyAndCount();
    return { data: alerts, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getUnreadCount(): Promise<number> {
    return this.alertRepo.count({ where: { status: AlertStatus.UNREAD } });
  }

  async markRead(id: string): Promise<void> {
    await this.alertRepo.update(id, { status: AlertStatus.READ });
  }

  async acknowledge(id: string): Promise<void> {
    await this.alertRepo.update(id, { status: AlertStatus.ACKNOWLEDGED });
  }

  async assign(id: string, userId: string): Promise<void> {
    await this.alertRepo.update(id, { assignedTo: userId });
  }

  async getStats() {
    const unread = await this.alertRepo.count({ where: { status: AlertStatus.UNREAD } });
    const critical = await this.alertRepo.count({ where: { severity: AlertSeverity.CRITICAL, status: AlertStatus.UNREAD } });
    const high = await this.alertRepo.count({ where: { severity: AlertSeverity.HIGH, status: AlertStatus.UNREAD } });
    return { unread, critical, high };
  }
}
