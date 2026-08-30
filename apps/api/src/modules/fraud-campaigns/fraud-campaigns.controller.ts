import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FraudCampaignsService } from './fraud-campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('fraud-campaigns')
@UseGuards(JwtAuthGuard)
export class FraudCampaignsController {
  constructor(private readonly fraudCampaignsService: FraudCampaignsService) {}

  @Get()
  async getCampaigns(@Query('mock') mock: string) {
    return this.fraudCampaignsService.getCampaigns(mock === 'true');
  }
}
