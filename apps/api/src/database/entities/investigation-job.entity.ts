import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { InvestigationStage } from '@chainsentinel/types';
import { Investigation } from './investigation.entity';

@Entity('investigation_jobs')
@Index(['investigationId'])
@Index(['stage'])
export class InvestigationJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'investigation_id' })
  investigationId: string;

  @Column({ type: 'enum', enum: InvestigationStage })
  stage: InvestigationStage;

  @Column({ type: 'enum', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'PENDING' })
  status: string;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @ManyToOne(() => Investigation, (i) => i.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investigation_id' })
  investigation: Investigation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
