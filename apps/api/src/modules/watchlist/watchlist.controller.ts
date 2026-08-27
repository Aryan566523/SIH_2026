import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WatchlistService } from './watchlist.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BlockchainType, WatchlistSensitivity } from '@chainsentinel/types';

@ApiTags('Watchlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('watchlist')
export class WatchlistController {
  constructor(private watchlistService: WatchlistService) {}

  @Post()
  @ApiOperation({ summary: 'Add wallet to watchlist' })
  async add(
    @CurrentUser('id') userId: string,
    @Body() body: {
      walletAddress: string;
      blockchain: BlockchainType;
      caseId?: string;
      reason: string;
      sensitivity?: WatchlistSensitivity;
    },
  ) {
    const entry = await this.watchlistService.add({ ...body, createdBy: userId });
    return { success: true, data: entry };
  }

  @Get()
  @ApiOperation({ summary: 'List watchlist entries' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.watchlistService.findAll({ page, limit });
    return { success: true, ...result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove from watchlist' })
  async remove(@Param('id') id: string) {
    await this.watchlistService.remove(id);
    return { success: true, message: 'Removed from watchlist' };
  }
}
