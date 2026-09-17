import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceRecord } from '../../database/entities/evidence-record.entity';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenceRecord]), AuditModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
