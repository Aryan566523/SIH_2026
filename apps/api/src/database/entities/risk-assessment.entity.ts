import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { RiskLevel } from '@chainsentinel/types';

@Entity('risk_assessments')
@Index(['walletId'])
export class RiskAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'risk_score' })
  riskScore: number;

  @Column({ type: 'simple-enum', enum: RiskLevel, name: 'risk_level' })
  riskLevel: RiskLevel;

  @Column({ type: 'simple-json', default: '[]' })
  factors: Array<{ factor: string; score: number; weight: number; description: string }>;

  @Column({ type: 'simple-json', default: '[]', name: 'fraud_patterns' })
  fraudPatterns: Array<{ patternType: string; confidence: number; riskContribution: number; description: string }>;

  @Column({ type: 'timestamp', name: 'assessed_at' })
  assessedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

