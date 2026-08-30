import { Module } from '@nestjs/common';
import { FraudCampaignsController } from './fraud-campaigns.controller';
import { FraudCampaignsService } from './fraud-campaigns.service';

@Module({
  controllers: [FraudCampaignsController],
  providers: [FraudCampaignsService],
  exports: [FraudCampaignsService],
})
export class FraudCampaignsModule {}
