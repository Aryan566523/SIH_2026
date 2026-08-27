import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  Index,
} from 'typeorm';
import { BlockchainType, WatchlistSensitivity } from '@chainsentinel/types';

@Entity('watchlist')
@Index(['walletAddress', 'isActive'])
@Index(['caseId'])
export class WatchlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_address', length: 255 })
  walletAddress: string;

  @Column({ type: 'enum', enum: BlockchainType })
  blockchain: BlockchainType;

  @Column({  name: 'case_id', nullable: true, type: 'varchar' })
  caseId: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: WatchlistSensitivity, default: WatchlistSensitivity.MEDIUM })
  sensitivity: WatchlistSensitivity;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ type: 'jsonb', default: '{}', name: 'watch_conditions' })
  watchConditions: Record<string, unknown>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
