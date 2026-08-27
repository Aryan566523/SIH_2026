import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Report } from '../../database/entities/report.entity';
import { Case } from '../../database/entities/case.entity';
import { Investigation } from '../../database/entities/investigation.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Investigation) private invRepo: Repository<Investigation>,
  ) {}

  async generate(caseId: string, generatedBy: string): Promise<Report> {
    const caseEntity = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: ['complaints'],
    });
    if (!caseEntity) throw new NotFoundException('Case not found');

    const investigations = await this.invRepo.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
    });

    const sections = [
      'cover',
      'case_details',
      'complaint_details',
      'investigation_scope',
      'suspect_wallet',
      'fund_flow_summary',
      'vasp_attribution',
      'risk_analysis',
      'fraud_patterns',
      'timeline',
      'evidence_references',
      'recommendations',
    ];

    // Generate report metadata as JSON
    const reportData = {
      generatedAt: new Date().toISOString(),
      generatedBy,
      case: {
        caseNumber: caseEntity.caseNumber,
        title: caseEntity.title,
        status: caseEntity.status,
        fraudType: caseEntity.fraudType,
        riskLevel: caseEntity.riskLevel,
      },
      complaints: caseEntity.complaints?.map((c) => ({
        complaintNumber: c.complaintNumber,
        suspectWallet: c.suspectWalletAddress,
        blockchain: c.blockchain,
        cryptocurrency: c.cryptocurrency,
        estimatedAmount: c.estimatedFraudAmount,
      })),
      investigations: investigations.map((inv) => ({
        status: inv.status,
        currentStage: inv.currentStage,
        progress: inv.progress,
        stats: inv.stats,
        startedAt: inv.startedAt,
        completedAt: inv.completedAt,
      })),
      sections,
    };

    // Calculate SHA-256 hash for integrity
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(reportData))
      .digest('hex');

    const report = this.reportRepo.create({
      caseId,
      title: `Investigation Report - ${caseEntity.caseNumber}`,
      generatedBy,
      sha256Hash: hash,
      version: '1.0',
      sections,
      metadata: reportData,
    });

    const saved = await this.reportRepo.save(report);

    this.logger.log(`Report generated for case ${caseEntity.caseNumber}, hash: ${hash.substring(0, 16)}...`);

    return saved;
  }

  async findByCaseId(caseId: string): Promise<Report[]> {
    return this.reportRepo.find({ where: { caseId }, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Report> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async verifyIntegrity(id: string): Promise<{ valid: boolean; hash: string }> {
    const report = await this.findById(id);
    const currentHash = crypto.createHash('sha256')
      .update(JSON.stringify(report.metadata))
      .digest('hex');

    return {
      valid: currentHash === report.sha256Hash,
      hash: report.sha256Hash || '',
    };
  }
}
