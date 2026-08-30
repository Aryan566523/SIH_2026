import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['actorId'])
@Index(['action'])
@Index(['resourceType'])
@Index(['organizationId'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ name: 'actor_email', length: 255 })
  actorEmail: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'resource_type', length: 100 })
  resourceType: string;

  @Column({ name: 'resource_id', nullable: true, type: 'varchar' })
  resourceId: string | null;

  @Column({ length: 20, default: 'SUCCESS' })
  result: string;

  @Column({ name: 'request_id', nullable: true, type: 'varchar' })
  requestId: string | null;

  @Column({ name: 'ip_address', nullable: true, length: 45, type: 'varchar' })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true, length: 500, type: 'varchar' })
  userAgent: string | null;

  @Column({ type: 'simple-json', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

