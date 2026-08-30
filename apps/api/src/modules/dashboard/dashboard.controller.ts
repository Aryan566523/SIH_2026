import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Query('mock') mock: string) {
    const data = await this.dashboardService.getStats(mock === 'true');
    return { success: true, data };
  }

  @Get('activity')
  async getActivity(@Query('limit') limit: number = 10, @Query('mock') mock: string) {
    const data = await this.dashboardService.getActivity(limit, mock === 'true');
    return { success: true, data };
  }

  @Get('charts/volume-by-chain')
  async getVolumeByChain(@Query('mock') mock: string) {
    const data = await this.dashboardService.getVolumeByChain(mock === 'true');
    return { success: true, data };
  }

  @Get('charts/risk-distribution')
  async getRiskDistribution(@Query('mock') mock: string) {
    const data = await this.dashboardService.getRiskDistribution(mock === 'true');
    return { success: true, data };
  }
}

