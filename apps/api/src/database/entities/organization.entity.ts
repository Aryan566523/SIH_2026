import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Case } from './case.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'simple-json', default: '{}' })
  settings: Record<string, unknown>;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Case, (c) => c.organization)
  cases: Case[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

