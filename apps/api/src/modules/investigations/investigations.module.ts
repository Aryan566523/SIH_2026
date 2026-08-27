import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { Investigation } from '../../database/entities/investigation.entity';
import { InvestigationJob } from '../../database/entities/investigation-job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Investigation, InvestigationJob])],
  controllers: [InvestigationsController],
  providers: [InvestigationsService],
  exports: [InvestigationsService],
})
export class InvestigationsModule {}
