import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { Case } from '../../database/entities/case.entity';
import { Complaint } from '../../database/entities/complaint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Complaint])],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
