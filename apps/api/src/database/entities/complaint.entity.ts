import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { BlockchainType } from '@chainsentinel/types';
import { Case } from './case.entity';

@Entity('complaints')
@Index(['caseId'])
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id' })
  caseId: string;

  @Column({ name: 'complaint_number', length: 50 })
  complaintNumber: string;

  @Column({  name: 'victim_reference', nullable: true, length: 255, type: 'varchar' })
  victimReference: string | null;

  @Column({ name: 'suspect_wallet_address', length: 255 })
  suspectWalletAddress: string;

  @Column({ type: 'enum', enum: BlockchainType, default: BlockchainType.UNKNOWN })
  blockchain: BlockchainType;

  @Column({ length: 20, default: 'USDT' })
  cryptocurrency: string;

  @Column({ name: 'estimated_fraud_amount', type: 'decimal', precision: 20, scale: 8, nullable: true })
  estimatedFraudAmount: string | null;

  @Column({ name: 'reported_timestamp', type: 'timestamp' })
  reportedTimestamp: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Case, (c) => c.complaints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
