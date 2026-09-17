import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { BoundedTracerService } from './bounded-tracer.service';

@Module({
  imports: [TypeOrmModule.forFeature([NormalizedTransaction, Wallet, VASP])],
  providers: [BoundedTracerService],
  exports: [BoundedTracerService],
})
export class TracingModule {}
