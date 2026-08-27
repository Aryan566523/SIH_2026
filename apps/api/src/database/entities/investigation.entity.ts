import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index,
} from 'typeorm';
import { InvestigationStatus, InvestigationStage, BlockchainType } from '@chainsentinel/types';
import { Case } from './case.entity';
import { InvestigationJob } from './investigation-job.entity';

@Entity('investigations')
@Index(['caseId'])
@Index(['status'])
export class Investigation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id' })
  caseId: string;

  @Column({ type: 'enum', enum: InvestigationStatus, default: InvestigationStatus.QUEUED })
  status: InvestigationStatus;

  @Column({ type: 'enum', enum: InvestigationStage, default: InvestigationStage.INVESTIGATION_REQUESTED, name: 'current_stage' })
  currentStage: InvestigationStage;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'suspect_wallet', length: 255 })
  suspectWallet: string;

  @Column({ type: 'enum', enum: BlockchainType, nullable: true })
  blockchain: BlockchainType | null;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  stats: Record<string, unknown> | null;

  @ManyToOne(() => Case, (c) => c.investigations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @OneToMany(() => InvestigationJob, (j) => j.investigation)
  jobs: InvestigationJob[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
