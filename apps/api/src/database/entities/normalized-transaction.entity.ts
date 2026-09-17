import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { BlockchainType, TransactionStatus, VerificationStatus } from '@chainsentinel/types';

@Entity('normalized_transactions')
@Index(['txHash'], { unique: true })
@Index(['from'])
@Index(['to'])
@Index(['chain'])
@Index(['timestamp'])
export class NormalizedTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: BlockchainType, name: 'chain' })
  chain: BlockchainType;

  @Column({ name: 'tx_hash', length: 255 })
  txHash: string;

  @Column({ name: 'block_number', type: 'integer' })
  blockNumber: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ length: 255 })
  from: string;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  to: string | null;

  @Column({ length: 20, default: 'ETH' })
  asset: string;

  @Column({ name: 'token_contract', length: 255, nullable: true, type: 'varchar' })
  tokenContract: string | null;

  @Column({ name: 'amount_raw', type: 'decimal', precision: 40, scale: 0 })
  amountRaw: string;

  @Column({ name: 'amount_normalized', type: 'decimal', precision: 20, scale: 8 })
  amountNormalized: string;

  @Column({ name: 'fiat_value_at_time', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fiatValueAtTime: number | null;

  @Column({ type: 'simple-enum', enum: TransactionStatus, default: TransactionStatus.CONFIRMED })
  status: TransactionStatus;

  /** CONDITION 1.1-1.3: single-source = unverified; dual-source agreement = verified; disagreement = conflict */
  @Column({ type: 'simple-enum', enum: VerificationStatus, default: VerificationStatus.UNVERIFIED, name: 'verification_status' })
  verificationStatus: VerificationStatus;

  /** RULES §1: every ingested tx carries source + collection time + sync state */
  @Column({ length: 100, default: 'unknown', name: 'data_source' })
  dataSource: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'collected_at' })
  collectedAt: Date;

  @Column({ length: 20, default: 'SYNCED', name: 'sync_state' })
  syncState: string;

  /** Per-source agreement detail, e.g. [{ name, kind, agreed, collectedAt }] (CONDITIONS 1.1-1.3) */
  @Column({ type: 'simple-json', nullable: true, name: 'verification_sources' })
  verificationSources: Array<Record<string, unknown>> | null;

  /** RULES §2: block-producer metadata tagged on every ingested tx, even when not under investigation */
  @Column({ length: 255, nullable: true, type: 'varchar', name: 'producer_address' })
  producerAddress: string | null;

  @Column({ length: 20, nullable: true, type: 'varchar', name: 'producer_type' })
  producerType: 'miner' | 'validator' | 'pool' | null;

  @Column({ type: 'simple-json', nullable: true, name: 'consensus_metadata' })
  consensusMetadata: Record<string, unknown> | null;

  /** CONDITION 1.5: set when a reorg affecting this tx's block has been revalidated */
  @Column({ type: 'timestamp', nullable: true, name: 'reorg_checked_at' })
  reorgCheckedAt: Date | null;

  @Column({ name: 'transaction_type', length: 50, default: 'transfer' })
  transactionType: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

