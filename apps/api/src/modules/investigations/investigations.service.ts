import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investigation } from '../../database/entities/investigation.entity';
import { InvestigationJob } from '../../database/entities/investigation-job.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { InvestigationStatus, InvestigationStage } from '@chainsentinel/types';
import { PipelineOrchestrator } from './pipeline.orchestrator';

@Injectable()
export class InvestigationsService {
  private readonly logger = new Logger(InvestigationsService.name);

  constructor(
    @InjectRepository(Investigation) private invRepo: Repository<Investigation>,
    @InjectRepository(InvestigationJob) private jobRepo: Repository<InvestigationJob>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    private readonly pipelineOrchestrator: PipelineOrchestrator,
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

    // RULES §0.6 — long-running work is asynchronous: kick off the pipeline
    // without blocking the request. Stage job rows checkpoint progress so a
    // crashed run can resume (CONDITIONS 3.1/3.4).
    setImmediate(() => {
      this.pipelineOrchestrator.runPipeline(saved.id, saved.suspectWallet).catch((err) => {
        this.logger.error(`Async pipeline launch failed for ${saved.id}: ${err?.message}`);
      });
    });

    return saved;
  }

  /**
   * Re-run or resume an investigation (CONDITION 8.4 — worker failure requeues the job;
   * resume from checkpoint rather than discarding prior stage work).
   */
  async runOrResume(id: string): Promise<Investigation> {
    const inv = await this.invRepo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('Investigation not found');
    if (inv.status === InvestigationStatus.RUNNING) {
      throw new NotFoundException('Investigation is already running');
    }

    await this.invRepo.update(id, {
      status: InvestigationStatus.QUEUED,
      failureReason: null,
      message: 'Investigation re-queued',
    });

    setImmediate(() => {
      this.pipelineOrchestrator.runPipeline(id, inv.suspectWallet).catch((err) => {
        this.logger.error(`Pipeline resume failed for ${id}: ${err?.message}`);
      });
    });

    return this.findById(id);
  }

  async findById(id: string): Promise<Investigation> {
    const inv = await this.invRepo.findOne({
      where: { id },
      relations: ['jobs', 'case'],
    });
    if (!inv) throw new NotFoundException('Investigation not found');

    // Self-healing: if an investigation has 0 transactions or 0 hops in stats, but verified on-chain transactions
    // exist in txRepo for this wallet (e.g. from smart scan or parallel ingest), re-synchronize and enrich stats.
    if (inv.suspectWallet && (!inv.stats || !(inv.stats as any).transactions || !(inv.stats as any).hops?.length)) {
      try {
        const cleanAddr = inv.suspectWallet.toLowerCase();
        const dbTxs = await this.txRepo.find({
          where: [
            { from: cleanAddr },
            { to: cleanAddr },
          ],
          order: { timestamp: 'DESC' },
          take: 50,
        });

        if (dbTxs.length > 0) {
          const currentStats = (inv.stats as any) || {};
          const allVasps = await this.vaspRepo.find().catch(() => []);

          const hops = dbTxs.map((t, idx) => {
            // Check if counterparty is a VASP
            const counterparty = (t.from === cleanAddr ? t.to : t.from) || '';
            const matchedVasp = allVasps.find((v: any) => {
              let wList: string[] = [];
              if (Array.isArray(v.wallets)) wList = v.wallets;
              else if (typeof v.wallets === 'string') {
                try { wList = JSON.parse(v.wallets); } catch { wList = []; }
              }
              return wList.some(w => (w || '').toLowerCase() === counterparty.toLowerCase());
            });

            return {
              hopIndex: idx + 1,
              from: t.from,
              to: t.to,
              amount: t.amountNormalized || '0',
              token: t.asset || 'ETH',
              txHash: t.txHash,
              timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
              status: t.status || 'CONFIRMED',
              blockNumber: t.blockNumber || 0,
              miner: matchedVasp ? `${matchedVasp.name} Validator` : 'Ethereum Validator Pool',
            };
          });

          // Detect VASPs across counterparties
          const detectedVasps: any[] = [];
          for (const tx of dbTxs) {
            const counterparties = [tx.from, tx.to].filter((x): x is string => Boolean(x));
            for (const cp of counterparties) {
              const cpLower = cp.toLowerCase();
              if (cpLower === cleanAddr) continue;
              const vasp = allVasps.find((v: any) => {
                let wList: string[] = [];
                if (Array.isArray(v.wallets)) wList = v.wallets;
                else if (typeof v.wallets === 'string') {
                  try { wList = JSON.parse(v.wallets); } catch { wList = []; }
                }
                return wList.some(w => (w || '').toLowerCase() === cpLower);
              });
              if (vasp && !detectedVasps.some(d => d.vasp === vasp.name)) {
                detectedVasps.push({
                  vasp: vasp.name,
                  vaspId: vasp.id,
                  confidence: (vasp.confidence || 95) / 100,
                  attributionState: 'CONFIRMED',
                  registryVersion: 'v1',
                  provenance: `Direct registry match: ${cp}`,
                  classification: vasp.jurisdiction ? 'SERVEABLE' : 'UNKNOWN',
                });
              }
            }
          }

          const vaspMatches = Math.max(detectedVasps.length, currentStats.vaspMatches || 0);
          const attributions = detectedVasps.length > 0 ? detectedVasps : (currentStats.attributions || []);

          // Intelligent, dynamic recommendations
          const recs: string[] = [
            `Preserve all ${dbTxs.length} verified on-chain transaction records with cryptographic SHA-256 integrity hashing.`,
          ];
          if (attributions.length > 0) {
            const vNames = attributions.map((a: any) => a.vasp).join(', ');
            recs.push(`Issue statutory Section 91 CrPC requisition notice to identified exchange compliance units (${vNames}) for KYC and bank settlement records.`);
            recs.push(`Request emergency debit freeze or lien marking on identified VASP account at ${attributions[0].vasp}.`);
          } else {
            recs.push('Expand forward multi-hop tracing depth to locate terminal custodial VASP off-ramps or OTC cash-out endpoints.');
          }
          recs.push(`Add suspect address ${inv.suspectWallet.substring(0, 10)}... to real-time watchlist monitoring.`);
          recs.push('Generate and sign official digital forensic report with complete SHA-256 evidence chain.');

          const updatedStats = {
            ...currentStats,
            transactions: dbTxs.length,
            wallets: Math.max(currentStats.wallets || 0, new Set(dbTxs.flatMap(t => [t.from, t.to].filter(Boolean))).size),
            hops,
            vaspMatches,
            attributions,
            recommendations: recs,
          };

          inv.stats = updatedStats as any;
          await this.invRepo.update(id, { stats: updatedStats as any });
        }
      } catch (healErr: any) {
        this.logger.warn(`Stats self-healing skipped for ${id}: ${healErr.message}`);
      }
    }

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
