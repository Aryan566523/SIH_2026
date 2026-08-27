import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search wallets' })
  async search(@Query('q') query: string, @Query('limit') limit?: number) {
    const wallets = await this.walletsService.search(query, limit);
    return { success: true, data: wallets };
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get wallet by address' })
  async getByAddress(
    @Param('address') address: string,
    @Query('blockchain') blockchain?: string,
  ) {
    const wallet = await this.walletsService.findByAddress(address, blockchain as any);
    return { success: true, data: wallet };
  }

  @Get(':address/transactions')
  @ApiOperation({ summary: 'Get wallet transactions' })
  async getTransactions(
    @Param('address') address: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('chain') chain?: string,
  ) {
    const result = await this.walletsService.getTransactions(address, {
      page, limit, chain: chain as any,
    });
    return { success: true, ...result };
  }

  @Get(':address/risk')
  @ApiOperation({ summary: 'Get wallet risk assessment' })
  async getRisk(@Param('address') address: string) {
    const wallet = await this.walletsService.findByAddress(address);
    const risk = await this.walletsService.getRiskAssessment(wallet.id);
    return { success: true, data: risk };
  }

  @Get(':address/attribution')
  @ApiOperation({ summary: 'Get wallet VASP attribution' })
  async getAttribution(@Param('address') address: string) {
    const wallet = await this.walletsService.findByAddress(address);
    const attrs = await this.walletsService.getAttributions(wallet.id);
    return { success: true, data: attrs };
  }
}
