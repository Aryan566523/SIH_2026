import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index,
} from 'typeorm';
import { CaseStatus, FraudType, RiskLevel } from '@chainsentinel/types';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Complaint } from './complaint.entity';
import { Investigation } from './investigation.entity';
import { Alert } from './alert.entity';

@Entity('cases')
@Index(['caseNumber'], { unique: true })
@Index(['status'])
@Index(['organizationId'])
@Index(['assignedInvestigatorId'])
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_number', unique: true, length: 50 })
  caseNumber: string;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'simple-enum', enum: CaseStatus, default: CaseStatus.DRAFT })
  status: CaseStatus;

  @Column({ type: 'simple-enum', enum: FraudType, name: 'fraud_type' })
  fraudType: FraudType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'complaint_id', nullable: true, type: 'varchar' })
  complaintId: string | null;

  @Column({ name: 'assigned_investigator_id', nullable: true, type: 'varchar' })
  assignedInvestigatorId: string | null;

  @Column({ name: 'supervisor_id', nullable: true, type: 'varchar' })
  supervisorId: string | null;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'simple-enum', enum: RiskLevel, default: RiskLevel.LOW, name: 'risk_level' })
  riskLevel: RiskLevel;

  @ManyToOne(() => Organization, (org) => org.cases)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_investigator_id' })
  assignedInvestigator: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor: User;

  @OneToMany(() => Complaint, (c) => c.case)
  complaints: Complaint[];

  @OneToMany(() => Investigation, (i) => i.case)
  investigations: Investigation[];

  @OneToMany(() => Alert, (a) => a.case)
  alerts: Alert[];

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

