import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BlockchainApiConfig } from './blockchain-api-config.entity';

@Entity('blockchain_fallback_configs')
export class BlockchainFallbackConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerName: string;

  @Column()
  endpointUrl: string;

  @Column({ nullable: true })
  apiKey: string;

  @Column()
  priority: number;

  @ManyToOne(() => BlockchainApiConfig, config => config.fallbacks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockchainApiConfigId' })
  config: BlockchainApiConfig;
}
