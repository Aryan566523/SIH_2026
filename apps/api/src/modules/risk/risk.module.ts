import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskService } from './risk.service';
import { MlRiskModel } from './ml-model';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiskAssessment, NormalizedTransaction, Wallet])],
  providers: [RiskService, MlRiskModel],
  exports: [RiskService],
})
export class RiskModule {}
