import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { RiskLevel, RiskClassification } from '@chainsentinel/types';

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

  /** CONDITION 5.1: UNKNOWN when confidence < threshold; INSUFFICIENT_DATA below minimum feature support */
  @Column({ type: 'simple-enum', enum: RiskClassification, name: 'classification', default: RiskClassification.UNKNOWN })
  classification: RiskClassification;

  /** Model confidence 0-1; degrades gracefully instead of forcing an answer (RULES §0.4) */
  @Column({ type: 'decimal', precision: 5, scale: 4, name: 'confidence', default: 0 })
  confidence: number;

  /** CONDITION 5.4: every prediction ships with an explanation + exact model version — mandatory */
  @Column({ type: 'simple-json', default: '[]', name: 'explanation' })
  explanation: Array<{ feature: string; contribution: number; value: string }>;

  @Column({ length: 100, name: 'model_version', default: 'rules-heuristic-v1' })
  modelVersion: string;

  @Column({ length: 64, nullable: true, type: 'varchar', name: 'model_hash' })
  modelHash: string | null;

  /** CONDITION 5.2: set when wallet history is below minimum feature-support count */
  @Column({ default: false, name: 'insufficient_data' })
  insufficientData: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  factors: Array<{ factor: string; score: number; weight: number; description: string }>;

  @Column({ type: 'simple-json', default: '[]', name: 'fraud_patterns' })
  fraudPatterns: Array<{ patternType: string; confidence: number; riskContribution: number; description: string }>;

  @Column({ type: 'timestamp', name: 'assessed_at' })
  assessedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

