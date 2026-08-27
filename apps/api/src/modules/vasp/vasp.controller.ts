import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VaspService } from './vasp.service';

@ApiTags('VASP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vasp')
export class VaspController {
  constructor(private vaspService: VaspService) {}

  @Get()
  @ApiOperation({ summary: 'List VASPs' })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number, @Query('type') type?: string) {
    const result = await this.vaspService.findAll({ page, limit, type });
    return { success: true, ...result };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get VASP statistics' })
  async getStats() {
    const stats = await this.vaspService.getStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get VASP by ID' })
  async findById(@Param('id') id: string) {
    const vasp = await this.vaspService.findById(id);
    return { success: true, data: vasp };
  }

  @Get('wallet/:address')
  @ApiOperation({ summary: 'Find VASP by wallet address' })
  async findByWallet(@Param('address') address: string) {
    const vasp = await this.vaspService.findByWallet(address);
    return { success: true, data: vasp };
  }

  @Get(':id/attributions')
  @ApiOperation({ summary: 'Get VASP attributions' })
  async getAttributions(@Param('id') id: string) {
    const attrs = await this.vaspService.getAttributions(id);
    return { success: true, data: attrs };
  }
}
