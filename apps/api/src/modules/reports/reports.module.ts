import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Report } from '../../database/entities/report.entity';
import { Case } from '../../database/entities/case.entity';
import { Investigation } from '../../database/entities/investigation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Case, Investigation])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
