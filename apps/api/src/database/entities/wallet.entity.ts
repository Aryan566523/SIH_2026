import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index,
} from 'typeorm';
import { BlockchainType, RiskLevel, NodeKind } from '@chainsentinel/types';

@Entity('wallets')
@Index(['address', 'blockchain'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  address: string;

  @Column({ type: 'simple-enum', enum: BlockchainType })
  blockchain: BlockchainType;

  @Column({ nullable: true, length: 255, type: 'varchar' })
  label: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'risk_score' })
  riskScore: number;

  @Column({ type: 'simple-enum', enum: RiskLevel, default: RiskLevel.LOW, name: 'risk_level' })
  riskLevel: RiskLevel;

  @Column({ nullable: true, name: 'entity_label', length: 255, type: 'varchar' })
  entityLabel: string | null;

  @Column({ nullable: true, name: 'vasp_id', type: 'varchar' })
  vaspId: string | null;

  @Column({ default: false, name: 'is_on_watchlist' })
  isOnWatchlist: boolean;

  /** RULES §2: wallet facts vs service attribution vs block-producer infrastructure are separate node types */
  @Column({ type: 'simple-enum', enum: NodeKind, default: NodeKind.WALLET, name: 'node_kind' })
  nodeKind: NodeKind;

  /** Only meaningful when nodeKind = INFRA: miner/validator/pool under escalation review (CONDITIONS 2.2-2.7) */
  @Column({ default: false, name: 'infra_escalated' })
  infraEscalated: boolean;

  @Column({ type: 'text', nullable: true, name: 'escalation_reason' })
  escalationReason: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0, name: 'total_received' })
  totalReceived: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0, name: 'total_sent' })
  totalSent: string;

  @Column({ type: 'timestamp', nullable: true, name: 'first_seen' })
  firstSeen: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_seen' })
  lastSeen: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

