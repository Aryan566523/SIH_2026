import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    actorId: string;
    actorEmail: string;
    organizationId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    result?: 'SUCCESS' | 'FAILURE';
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const entry = this.auditRepo.create({
      ...data,
      result: data.result || 'SUCCESS',
    });
    await this.auditRepo.save(entry);
  }

  async findAll(options?: { page?: number; limit?: number; action?: string; organizationId?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const qb = this.auditRepo.createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.action) qb.andWhere('a.action = :action', { action: options.action });
    if (options?.organizationId) qb.andWhere('a.organization_id = :orgId', { orgId: options.organizationId });

    const [logs, total] = await qb.getManyAndCount();
    return { data: logs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
