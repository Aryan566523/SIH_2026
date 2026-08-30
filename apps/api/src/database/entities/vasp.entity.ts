import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index,
} from 'typeorm';
import { BlockchainType } from '@chainsentinel/types';

@Entity('vasps')
@Index(['name'])
export class VASP {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50 })
  type: string;

  @Column({ type: 'simple-json', default: '[]' })
  wallets: string[];

  @Column({ type: 'simple-json', default: '[]' })
  chains: BlockchainType[];

  @Column({ length: 100, nullable: true, type: 'varchar' })
  jurisdiction: string | null;

  @Column({ length: 255, default: 'manual' })
  source: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number;

  @Column({ length: 50, default: 'UNVERIFIED', name: 'verification_status' })
  verificationStatus: string;

  @Column({ name: 'first_seen', type: 'timestamp' })
  firstSeen: Date;

  @Column({ name: 'last_updated', type: 'timestamp' })
  lastUpdated: Date;

  @Column({ type: 'simple-json', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

