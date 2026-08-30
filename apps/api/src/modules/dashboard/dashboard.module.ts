import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Investigation } from '../../database/entities/investigation.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Case } from '../../database/entities/case.entity';
import { Alert } from '../../database/entities/alert.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { WatchlistEntry } from '../../database/entities/watchlist.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Investigation, Wallet, Case, Alert, VASP, WatchlistEntry, AuditLog])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
