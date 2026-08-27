import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post(':caseId/generate')
  @ApiOperation({ summary: 'Generate investigation report' })
  async generate(@Param('caseId') caseId: string, @CurrentUser('id') userId: string) {
    const report = await this.reportsService.generate(caseId, userId);
    return { success: true, data: report };
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get reports for a case' })
  async findByCase(@Param('caseId') caseId: string) {
    const reports = await this.reportsService.findByCaseId(caseId);
    return { success: true, data: reports };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  async findById(@Param('id') id: string) {
    const report = await this.reportsService.findById(id);
    return { success: true, data: report };
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify report integrity' })
  async verifyIntegrity(@Param('id') id: string) {
    const result = await this.reportsService.verifyIntegrity(id);
    return { success: true, data: result };
  }
}
