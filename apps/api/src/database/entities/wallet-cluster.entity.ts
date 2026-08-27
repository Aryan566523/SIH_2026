import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { BlockchainType } from '@chainsentinel/types';

@Entity('wallet_clusters')
@Index(['chain'])
export class WalletCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  wallets: string[];

  @Column({ length: 50, default: 'UNKNOWN' })
  confidence: string;

  @Column({ type: 'jsonb', default: '[]' })
  reasons: string[];

  @Column({ type: 'enum', enum: BlockchainType })
  chain: BlockchainType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
