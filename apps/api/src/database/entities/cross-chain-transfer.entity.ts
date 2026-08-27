import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { BlockchainType } from '@chainsentinel/types';

@Entity('cross_chain_transfers')
@Index(['sourceChain'])
@Index(['destinationChain'])
@Index(['sourceWallet'])
@Index(['bridge'])
export class CrossChainTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BlockchainType, name: 'source_chain' })
  sourceChain: BlockchainType;

  @Column({ name: 'source_wallet', length: 255 })
  sourceWallet: string;

  @Column({ name: 'source_transaction', length: 255 })
  sourceTransaction: string;

  @Column({ name: 'source_asset', length: 20 })
  sourceAsset: string;

  @Column({ length: 255 })
  bridge: string;

  @Column({ type: 'enum', enum: BlockchainType, name: 'destination_chain' })
  destinationChain: BlockchainType;

  @Column({  name: 'destination_transaction', length: 255, nullable: true, type: 'varchar' })
  destinationTransaction: string | null;

  @Column({  name: 'destination_wallet', length: 255, nullable: true, type: 'varchar' })
  destinationWallet: string | null;

  @Column({ name: 'destination_asset', length: 20 })
  destinationAsset: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  amount: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
