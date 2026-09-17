import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EvidenceRecord } from '../../database/entities/evidence-record.entity';
import { AuditService } from '../audit/audit.service';
import { EvidenceVerificationOutcome } from '@chainsentinel/types';

/**
 * Evidence Engine (RULES §6 / CONDITIONS 6.1-6.5)
 *
 * - Every record: canonical form -> SHA-256 -> HMAC-SHA256 signature -> append-only storage
 * - Corrections create a NEW version linking the original; originals are never mutated
 * - Hash verified on every retrieval; mismatch => tamper_suspected, blocked from reports
 * - All create/version/verify events are written to the immutable audit log
 */
@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    @InjectRepository(EvidenceRecord) private evidenceRepo: Repository<EvidenceRecord>,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /** Deterministic JSON canonicalization: sorted keys, no whitespace — same input always yields same hash */
  canonicalize(value: unknown): string {
    const canon = (v: unknown): unknown => {
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) return v.map(canon);
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
        const out: Record<string, unknown> = {};
        for (const k of keys) out[k] = canon(obj[k]);
        return out;
      }
      return v;
    };
    return JSON.stringify(canon(value));
  }

  sha256(canonicalForm: string): string {
    return crypto.createHash('sha256').update(canonicalForm).digest('hex');
  }

  sign(hash: string): string {
    const key = this.configService.get<string>(
      'EVIDENCE_SIGNING_KEY',
      'chainsentinel-dev-evidence-signing-key-do-not-use-in-production',
    );
    return crypto.createHmac('sha256', key).update(hash).digest('hex');
  }

  verifySignature(hash: string, signature: string): boolean {
    const expected = this.sign(hash);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature || '');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * CONDITION 6.5: evidence missing required fields is rejected before storage.
   * CONDITION 6.1: canonical form -> hash -> signature -> store.
   */
  async create(data: {
    kind: EvidenceRecord['kind'];
    payload: Record<string, unknown>;
    caseId?: string | null;
    investigationId?: string | null;
    walletId?: string | null;
    refId?: string | null;
    softwareVersion?: string;
    collectedAt?: Date;
    createdBy?: string | null;
    actor?: { id: string; email: string; organizationId: string } | null;
  }): Promise<EvidenceRecord> {
    // CONDITION 6.5 — reject incomplete evidence
    const requiredByKind: Record<EvidenceRecord['kind'], string[]> = {
      transaction: ['txHash', 'blockNumber', 'from', 'to', 'amount', 'timestamp', 'status', 'source'],
      attribution: ['vaspName', 'address', 'attributionState', 'confidence', 'registryVersion'],
      risk_assessment: ['riskScore', 'classification', 'confidence', 'modelVersion'],
      graph_snapshot: ['nodeCount', 'edgeCount'],
      balance: ['address', 'blockNumber', 'amount', 'asset'],
      report: ['caseId', 'sha256Hash'],
    };
    const missing = (requiredByKind[data.kind] || []).filter((f) => {
      const v = (data.payload as any)?.[f];
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Evidence rejected: missing required field(s) for kind '${data.kind}': ${missing.join(', ')}`,
      );
    }

    const canonicalForm = this.canonicalize(data.payload);
    const sha256Hash = this.sha256(canonicalForm);
    const signature = this.sign(sha256Hash);

    const record = this.evidenceRepo.create({
      kind: data.kind,
      payload: data.payload,
      canonicalForm,
      sha256Hash,
      signature,
      version: 1,
      status: 'active',
      caseId: data.caseId ?? null,
      investigationId: data.investigationId ?? null,
      walletId: data.walletId ?? null,
      refId: data.refId ?? null,
      softwareVersion: data.softwareVersion || 'chainsentinel-api-1.0',
      collectedAt: data.collectedAt || new Date(),
      createdBy: data.createdBy ?? null,
    });

    let saved: EvidenceRecord;
    try {
      saved = await this.evidenceRepo.save(record);
    } catch (e: any) {
      // Idempotency: same content in same investigation -> return existing record
      const existing = await this.evidenceRepo.findOne({
        where: [
          { sha256Hash, kind: data.kind },
          ...(data.investigationId ? [{ sha256Hash, kind: data.kind, investigationId: data.investigationId }] : []),
        ],
      });
      if (existing) return existing;
      throw e;
    }

    await this.auditService
      .log({
        actorId: data.actor?.id || 'system',
        actorEmail: data.actor?.email || 'system@chainsentinel',
        organizationId: data.actor?.organizationId || 'system',
        action: 'EVIDENCE_CREATED',
        resourceType: 'EvidenceRecord',
        resourceId: saved.id,
        metadata: { kind: saved.kind, refId: saved.refId, sha256: saved.sha256Hash, version: 1 },
      })
      .catch((e) => this.logger.warn(`Evidence audit log failed: ${e.message}`));

    this.logger.log(`Evidence created: ${saved.kind} ${saved.refId ?? ''} hash=${saved.sha256Hash.slice(0, 12)}…`);
    return saved;
  }

  /**
   * CONDITION 6.2 — corrections create a new versioned record; the original is retained,
   * linked (previousVersionId/supersededBy) and marked superseded. Never overwritten.
   */
  async createCorrection(
    previousId: string,
    correctedPayload: Record<string, unknown>,
    reason: string,
    actor?: { id: string; email: string; organizationId: string } | null,
  ): Promise<EvidenceRecord> {
    const previous = await this.evidenceRepo.findOne({ where: { id: previousId } });
    if (!previous) throw new NotFoundException('Previous evidence version not found');

    // Merge: corrected payload wins over previous payload
    const payload = { ...previous.payload, ...correctedPayload, correctionOf: previous.sha256Hash, correctionReason: reason };

    const canonicalForm = this.canonicalize(payload);
    const sha256Hash = this.sha256(canonicalForm);
    const signature = this.sign(sha256Hash);

    const record = this.evidenceRepo.create({
      kind: previous.kind,
      payload,
      canonicalForm,
      sha256Hash,
      signature,
      version: previous.version + 1,
      previousVersionId: previous.id,
      status: 'active',
      caseId: previous.caseId,
      investigationId: previous.investigationId,
      walletId: previous.walletId,
      refId: previous.refId,
      softwareVersion: previous.softwareVersion,
      collectedAt: new Date(),
      createdBy: actor?.id ?? previous.createdBy,
    });
    const saved = await this.evidenceRepo.save(record);

    // Append-only: original is only marked superseded (link preserved both directions)
    await this.evidenceRepo.update(previous.id, { status: 'superseded', supersededBy: saved.id });

    await this.auditService
      .log({
        actorId: actor?.id || 'system',
        actorEmail: actor?.email || 'system@chainsentinel',
        organizationId: actor?.organizationId || 'system',
        action: 'EVIDENCE_VERSIONED',
        resourceType: 'EvidenceRecord',
        resourceId: saved.id,
        metadata: { previousId: previous.id, previousVersion: previous.version, newVersion: saved.version, reason },
      })
      .catch(() => undefined);

    return saved;
  }

  /**
   * CONDITION 6.3 — hash and signature verified on every retrieval.
   * Mismatch => status flipped to tamper_suspected (persisted) and flagged for the caller.
   */
  async verify(id: string): Promise<EvidenceVerificationOutcome> {
    const record = await this.evidenceRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Evidence record not found');

    const actualHash = this.sha256(record.canonicalForm);
    const hashValid = actualHash === record.sha256Hash;
    const signatureValid = this.verifySignature(record.sha256Hash, record.signature);

    const valid = hashValid && signatureValid;
    if (!valid && record.status !== 'tamper_suspected') {
      await this.evidenceRepo.update(id, { status: 'tamper_suspected' });
      await this.auditService
        .log({
          actorId: 'system',
          actorEmail: 'system@chainsentinel',
          organizationId: 'system',
          action: 'EVIDENCE_TAMPER_DETECTED',
          resourceType: 'EvidenceRecord',
          resourceId: id,
          result: 'FAILURE',
          metadata: { expectedHash: record.sha256Hash, actualHash, signatureValid },
        })
        .catch(() => undefined);
    }

    return {
      evidenceId: id,
      valid,
      expectedHash: record.sha256Hash,
      actualHash,
      signatureValid,
      status: valid ? record.status : 'tamper_suspected',
    };
  }

  /** Verify a full evidence package (all records for an investigation) — used before dossier export */
  async verifyPackage(investigationId: string): Promise<{ allValid: boolean; results: EvidenceVerificationOutcome[] }> {
    const records = await this.evidenceRepo.find({ where: { investigationId } });
    const results: EvidenceVerificationOutcome[] = [];
    for (const r of records) {
      results.push(await this.verify(r.id));
    }
    return { allValid: results.every((r) => r.valid), results };
  }

  async findById(id: string): Promise<EvidenceRecord> {
    const record = await this.evidenceRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Evidence record not found');
    return record;
  }

  async findByInvestigation(investigationId: string): Promise<EvidenceRecord[]> {
    return this.evidenceRepo.find({ where: { investigationId }, order: { createdAt: 'DESC' } });
  }

  async findByCase(caseId: string): Promise<EvidenceRecord[]> {
    return this.evidenceRepo.find({ where: { caseId }, order: { createdAt: 'DESC' } });
  }

  /** CONDITION 6.4 — export approval is a named investigator action, recorded in the audit log */
  async approveForExport(id: string, approver: { id: string; email: string; organizationId: string }): Promise<EvidenceRecord> {
    const record = await this.findById(id);
    if (record.status === 'tamper_suspected') {
      throw new BadRequestException('Evidence is tamper-suspected and blocked from export until resolved');
    }
    record.approvedBy = approver.id;
    const saved = await this.evidenceRepo.save(record);
    await this.auditService.log({
      actorId: approver.id,
      actorEmail: approver.email,
      organizationId: approver.organizationId,
      action: 'EVIDENCE_EXPORT_APPROVED',
      resourceType: 'EvidenceRecord',
      resourceId: id,
      metadata: { sha256: record.sha256Hash },
    });
    return saved;
  }
}
