import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { BlockchainConfigService } from './blockchain-config.service';
import { BlockchainProviderFactory } from './blockchain-provider.factory';

@Controller('blockchain-configs')
export class BlockchainConfigController {
  constructor(
    private readonly configService: BlockchainConfigService,
    private readonly providerFactory: BlockchainProviderFactory,
  ) {}

  @Get()
  async getAllConfigs(@Query('isActive') isActive?: string) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const data = await this.configService.findAll(active);
    return { success: true, data };
  }

  @Get('auto-detect')
  async autoDetect(@Query('address') address: string) {
    if (!address) return { success: false, error: 'Address required' };
    const result = await this.configService.autoDetect(address);
    return { success: true, data: result };
  }

  @Get(':id')
  async getConfig(@Param('id') id: string) {
    const data = await this.configService.findById(id);
    return { success: true, data };
  }

  @Post()
  async createConfig(@Body() body: any) {
    const data = await this.configService.create(body);
    return { success: true, data };
  }

  @Put(':id')
  async updateConfig(@Param('id') id: string, @Body() body: any) {
    const data = await this.configService.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  async deleteConfig(@Param('id') id: string) {
    await this.configService.remove(id);
    return { success: true };
  }

  @Post(':id/test-connection')
  async testConnection(@Param('id') id: string, @Body('address') address: string) {
    const result = await this.configService.testConnection(id, address);
    return { success: true, data: result };
  }
}

