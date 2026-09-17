import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { AttributionState, IdentityAttribution } from '@chainsentinel/types';

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

  /** CONDITION 4.1-4.3: Confirmed (registry match) / Probable (pattern) / Unknown (no guess) */
  @Column({ type: 'simple-enum', enum: AttributionState, default: AttributionState.UNKNOWN, name: 'attribution_state' })
  attributionState: AttributionState;

  /** Registry version + freshness stamp used for this attribution (CONDITIONS 4.5, registry versioning) */
  @Column({ length: 100, default: 'v1', name: 'registry_version' })
  registryVersion: string;

  @Column({ type: 'timestamp', nullable: true, name: 'registry_checked_at' })
  registryCheckedAt: Date | null;

  @Column({ default: false, name: 'registry_stale' })
  registryStale: boolean;

  /** CONDITION 4.4: custodial/omnibus wallets are attributed to the service only — identity is never implied */
  @Column({ type: 'simple-enum', enum: IdentityAttribution, default: IdentityAttribution.NOT_DETERMINED, name: 'identity_attribution' })
  identityAttribution: IdentityAttribution;

  @Column({ type: 'simple-json', default: '[]' })
  factors: Array<{ factor: string; weight: number; contribution: number }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

