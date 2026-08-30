import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrossChainTransfersController } from './cross-chain-transfers.controller';
import { CrossChainTransfersService } from './cross-chain-transfers.service';
import { CrossChainTransfer } from '../../database/entities/cross-chain-transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CrossChainTransfer])],
  controllers: [CrossChainTransfersController],
  providers: [CrossChainTransfersService],
  exports: [CrossChainTransfersService],
})
export class CrossChainTransfersModule {}
