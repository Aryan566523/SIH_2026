import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('attributions')
@Index(['walletId'])
@Index(['vaspId'])
export class Attribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @Column({ name: 'vasp_id' })
  vaspId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence: number;

  @Column({ type: 'int', default: 0 })
  distance: number;

  @Column({ name: 'traceable_amount', type: 'decimal', precision: 20, scale: 8, default: 0 })
  traceableAmount: string;

  @Column({ default: false, name: 'cross_chain' })
  crossChain: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  path: string[];

  @Column({ type: 'simple-json', default: '[]', name: 'supporting_transactions' })
  supportingTransactions: string[];

  @Column({ length: 255, name: 'label_source', default: 'manual' })
  labelSource: string;

  @Column({ type: 'simple-json', default: '[]' })
  factors: Array<{ factor: string; weight: number; contribution: number }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

