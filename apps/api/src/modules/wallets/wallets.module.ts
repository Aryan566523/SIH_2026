import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { Wallet } from '../../database/entities/wallet.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { BlockchainConfigModule } from '../blockchain-config/blockchain-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, NormalizedTransaction, RiskAssessment, Attribution]),
    BlockchainConfigModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
