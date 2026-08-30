import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  async check() {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'chainsentinel-api' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  async ready() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  async live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check' })
  async detailed() {
    const checks = await this.healthService.checkAll();
    const allHealthy = Object.values(checks).every((c: any) => c.status === 'HEALTHY');
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: checks,
    };
  }

  @Public()
  @Get('blockchain-providers')
  @ApiOperation({ summary: 'Blockchain providers health check' })
  async providers() {
    const checks = await this.healthService.checkAll();
    const providers = {
      ethProvider: checks.ethProvider,
      tronProvider: checks.tronProvider,
    };
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      providers,
    };
  }
}
