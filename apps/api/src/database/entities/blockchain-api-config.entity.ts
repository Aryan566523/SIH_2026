import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { BlockchainType } from '@chainsentinel/types';
import { BlockchainFallbackConfig } from './blockchain-fallback-config.entity';

@Entity('blockchain_api_configs')
export class BlockchainApiConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: BlockchainType, unique: true })
  chain: BlockchainType;

  @Column()
  name: string;

  @Column({ nullable: true })
  chainId: string;

  @Column()
  nativeToken: string;

  @Column()
  dataModel: 'ACCOUNT' | 'UTXO';

  @Column()
  primaryProviderName: string;

  @Column()
  primaryEndpointUrl: string;

  @Column({ nullable: true })
  apiKey: string;

  @Column({ default: 1000 })
  rateLimitMs: number;

  @Column({ default: 5000 })
  timeoutMs: number;

  @Column({ nullable: true })
  addressRegex: string;

  @Column({ nullable: true })
  checksumType: string;

  @Column({ type: 'simple-json', nullable: true })
  vaspWallets: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  bridgeContracts: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  dexRouters: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'unknown' })
  status: string;

  @OneToMany(() => BlockchainFallbackConfig, fallback => fallback.config, { cascade: true, eager: true })
  fallbacks: BlockchainFallbackConfig[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
