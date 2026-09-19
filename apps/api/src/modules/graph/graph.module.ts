import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';
import { AddressClassifierService } from './address-classifier.service';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { BlockchainConfigModule } from '../blockchain-config/blockchain-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([NormalizedTransaction, Wallet]), BlockchainConfigModule],
  controllers: [GraphController],
  providers: [GraphService, AddressClassifierService],
  exports: [GraphService, AddressClassifierService],
})
export class GraphModule {}
