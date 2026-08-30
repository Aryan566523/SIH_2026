import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { PipelineOrchestrator } from './pipeline.orchestrator';
import { Investigation } from '../../database/entities/investigation.entity';
import { InvestigationJob } from '../../database/entities/investigation-job.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Report } from '../../database/entities/report.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { Alert } from '../../database/entities/alert.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { BlockchainConfigModule } from '../blockchain-config/blockchain-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Investigation, InvestigationJob, Wallet, NormalizedTransaction, Report, Attribution, VASP, Alert]),
    WebSocketModule,
    BlockchainConfigModule
  ],
  controllers: [InvestigationsController],
  providers: [InvestigationsService, PipelineOrchestrator],
  exports: [InvestigationsService, PipelineOrchestrator],
})
export class InvestigationsModule {}

