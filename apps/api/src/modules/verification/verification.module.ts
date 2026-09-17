import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { VerificationSource } from './verification-source.entity';
import { VerificationService } from './verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([NormalizedTransaction, VerificationSource])],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
