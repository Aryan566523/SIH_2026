import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CrossChainTransfersService } from './cross-chain-transfers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('cross-chain-transfers')
@UseGuards(JwtAuthGuard)
export class CrossChainTransfersController {
  constructor(private readonly service: CrossChainTransfersService) {}

  @Get()
  async getTransfers(@Query('mock') mock: string) {
    return this.service.getTransfers(mock === 'true');
  }
}
