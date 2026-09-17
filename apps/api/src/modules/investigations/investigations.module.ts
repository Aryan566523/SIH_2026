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
import { CrossChainTransfer } from '../../database/entities/cross-chain-transfer.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { BlockchainConfigModule } from '../blockchain-config/blockchain-config.module';
import { VerificationModule } from '../verification/verification.module';
import { TracingModule } from '../tracing/tracing.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Investigation, InvestigationJob, Wallet, NormalizedTransaction, Report, Attribution, VASP, Alert, CrossChainTransfer]),
    WebSocketModule,
    BlockchainConfigModule,
    VerificationModule,
    TracingModule,
    EvidenceModule,
  ],
  controllers: [InvestigationsController],
  providers: [InvestigationsService, PipelineOrchestrator],
  exports: [InvestigationsService, PipelineOrchestrator],
})
export class InvestigationsModule {}

