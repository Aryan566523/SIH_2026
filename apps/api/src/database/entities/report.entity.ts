import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('reports')
@Index(['caseId'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id' })
  caseId: string;

  @Column({ length: 500 })
  title: string;

  @Column({ name: 'generated_by' })
  generatedBy: string;

  @Column({  name: 'file_url', nullable: true, type: 'varchar' })
  fileUrl: string | null;

  @Column({  name: 'sha256_hash', nullable: true, length: 64, type: 'varchar' })
  sha256Hash: string | null;

  @Column({ length: 20, default: '1.0' })
  version: string;

  @Column({ type: 'jsonb', default: '[]' })
  sections: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
