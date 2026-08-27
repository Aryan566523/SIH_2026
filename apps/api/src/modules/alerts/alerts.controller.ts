import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AlertsService } from './alerts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertSeverity, AlertStatus } from '@chainsentinel/types';

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List alerts' })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('severity') severity?: AlertSeverity,
    @Query('status') status?: AlertStatus,
    @Query('caseId') caseId?: string,
  ) {
    const result = await this.alertsService.findAll(orgId, { page, limit, severity, status, caseId });
    return { success: true, ...result };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread alert count' })
  async getUnreadCount() {
    const count = await this.alertsService.getUnreadCount();
    return { success: true, data: { count } };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get alert statistics' })
  async getStats() {
    const stats = await this.alertsService.getStats();
    return { success: true, data: stats };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  async markRead(@Param('id') id: string) {
    await this.alertsService.markRead(id);
    return { success: true };
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge alert' })
  async acknowledge(@Param('id') id: string) {
    await this.alertsService.acknowledge(id);
    return { success: true };
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign alert' })
  async assign(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.alertsService.assign(id, userId);
    return { success: true };
  }
}
