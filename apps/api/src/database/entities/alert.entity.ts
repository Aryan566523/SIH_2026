import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { AlertSeverity, AlertStatus } from '@chainsentinel/types';
import { Case } from './case.entity';

@Entity('alerts')
@Index(['severity'])
@Index(['status'])
@Index(['caseId'])
@Index(['walletAddress'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', nullable: true, type: 'varchar' })
  caseId: string | null;

  @Column({ name: 'wallet_address', nullable: true, length: 255, type: 'varchar' })
  walletAddress: string | null;

  @Column({ type: 'simple-enum', enum: AlertSeverity, default: AlertSeverity.INFO })
  severity: AlertSeverity;

  @Column({ type: 'simple-enum', enum: AlertStatus, default: AlertStatus.UNREAD })
  status: AlertStatus;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ length: 100, default: 'system' })
  type: string;

  @Column({ type: 'simple-json', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ name: 'assigned_to', nullable: true, type: 'varchar' })
  assignedTo: string | null;

  @ManyToOne(() => Case, (c) => c.alerts, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

