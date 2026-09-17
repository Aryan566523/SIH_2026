import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { Wallet } from '../../database/entities/wallet.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { BlockchainConfigModule } from '../blockchain-config/blockchain-config.module';
import { VaspModule } from '../vasp/vasp.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, NormalizedTransaction, RiskAssessment, Attribution, VASP]),
    BlockchainConfigModule,
    forwardRef(() => VaspModule),
    forwardRef(() => RiskModule),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}

