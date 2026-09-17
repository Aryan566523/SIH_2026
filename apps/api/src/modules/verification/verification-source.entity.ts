import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/** Registry of blockchain data sources: own node, independent RPCs, indexers (CONDITION 1.8, RULES §8) */
@Entity('verification_sources')
@Index(['chain', 'isActive'])
export class VerificationSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  chain: string;

  @Column({ length: 100 })
  name: string;

  /** own_node | independent_rpc | indexer | cache | mock */
  @Column({ length: 30, default: 'independent_rpc' })
  kind: 'own_node' | 'independent_rpc' | 'indexer' | 'cache' | 'mock';

  @Column({ nullable: true, type: 'varchar', length: 500 })
  endpoint: string | null;

  @Column({ default: true })
  isActive: boolean;

  /** Lower = tried first; own nodes before public RPCs */
  @Column({ default: 1, type: 'int' })
  priority: number;

  @Column({ length: 20, default: 'HEALTHY' })
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';

  @Column({ type: 'timestamp', nullable: true, name: 'last_failure_at' })
  lastFailureAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
