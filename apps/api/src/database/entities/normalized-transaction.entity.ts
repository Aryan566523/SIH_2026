import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { BlockchainType, TransactionStatus } from '@chainsentinel/types';

@Entity('normalized_transactions')
@Index(['txHash'], { unique: true })
@Index(['from'])
@Index(['to'])
@Index(['chain'])
@Index(['timestamp'])
export class NormalizedTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BlockchainType, name: 'chain' })
  chain: BlockchainType;

  @Column({ name: 'tx_hash', length: 255 })
  txHash: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ length: 255 })
  from: string;

  @Column({  length: 255, nullable: true, type: 'varchar' })
  to: string | null;

  @Column({ length: 20, default: 'ETH' })
  asset: string;

  @Column({  name: 'token_contract', length: 255, nullable: true, type: 'varchar' })
  tokenContract: string | null;

  @Column({ name: 'amount_raw', type: 'decimal', precision: 40, scale: 0 })
  amountRaw: string;

  @Column({ name: 'amount_normalized', type: 'decimal', precision: 20, scale: 8 })
  amountNormalized: string;

  @Column({ name: 'fiat_value_at_time', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fiatValueAtTime: number | null;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.CONFIRMED })
  status: TransactionStatus;

  @Column({ name: 'transaction_type', length: 50, default: 'transfer' })
  transactionType: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
