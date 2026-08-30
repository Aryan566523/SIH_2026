import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainConfigController } from './blockchain-config.controller';
import { BlockchainConfigService } from './blockchain-config.service';
import { BlockchainProviderFactory } from './blockchain-provider.factory';
import { MockBlockchainProvider } from './mock-blockchain.provider';
import { BlockchainApiConfig, BlockchainFallbackConfig } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainApiConfig, BlockchainFallbackConfig])],
  controllers: [BlockchainConfigController],
  providers: [BlockchainConfigService, BlockchainProviderFactory, MockBlockchainProvider],
  exports: [BlockchainConfigService, BlockchainProviderFactory],
})
export class BlockchainConfigModule {}
