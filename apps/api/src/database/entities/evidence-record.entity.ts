import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * Append-only evidence record (RULES §6 / CONDITIONS 6.1-6.5):
 * - created via canonical form -> SHA-256 -> digital signature
 * - never mutated; corrections create a new version linked to the original
 * - hash verified on retrieval; mismatch => tamper_suspected and blocked from reports
 */
@Entity('evidence_records')
@Index(['caseId'])
@Index(['investigationId'])
@Index(['kind', 'refId'])
@Index(['status'])
export class EvidenceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', nullable: true, type: 'varchar' })
  caseId: string | null;

  @Column({ name: 'investigation_id', nullable: true, type: 'varchar' })
  investigationId: string | null;

  @Column({ name: 'wallet_id', nullable: true, type: 'varchar' })
  walletId: string | null;

  /** What kind of fact this evidence object canonically represents */
  @Column({ length: 50 })
  kind: 'transaction' | 'attribution' | 'risk_assessment' | 'graph_snapshot' | 'balance' | 'report';

  /** Id of the source object (tx hash, attribution id, ...) this evidence packages */
  @Column({ name: 'ref_id', nullable: true, type: 'varchar' })
  refId: string | null;

  /** Canonical JSON payload of the underlying fact (tx hash, block, from, to, token, amount, ...) */
  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  /** Deterministic canonical JSON string that was hashed and signed */
  @Column({ type: 'text' })
  canonicalForm: string;

  /** SHA-256 of canonicalForm */
  @Column({ length: 64, name: 'sha256_hash' })
  sha256Hash: string;

  /** Digital signature (HMAC-SHA256 of the hash with the evidence signing key) */
  @Column({ type: 'text' })
  signature: string;

  @Column({ default: 1 })
  version: number;

  @Column({ name: 'previous_version_id', nullable: true, type: 'varchar' })
  previousVersionId: string | null;

  @Column({ name: 'superseded_by', nullable: true, type: 'varchar' })
  supersededBy: string | null;

  @Column({ length: 30, default: 'active' })
  status: 'active' | 'superseded' | 'tamper_suspected';

  /** Software/indexer/model versions that produced the fact — required for reproducibility */
  @Column({ name: 'software_version', length: 255, default: 'unknown' })
  softwareVersion: string;

  @Column({ type: 'timestamp', name: 'collected_at' })
  collectedAt: Date;

  @Column({ name: 'created_by', nullable: true, type: 'varchar' })
  createdBy: string | null;

  /** Named investigator approval required before legal/forensic export (CONDITIONS: export approval) */
  @Column({ name: 'approved_by', nullable: true, type: 'varchar' })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
