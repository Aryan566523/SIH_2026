import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaspController } from './vasp.controller';
import { VaspService } from './vasp.service';
import { VASP } from '../../database/entities/vasp.entity';
import { Attribution } from '../../database/entities/attribution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VASP, Attribution])],
  controllers: [VaspController],
  providers: [VaspService],
  exports: [VaspService],
})
export class VaspModule {}
