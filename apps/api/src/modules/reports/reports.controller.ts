import { Controller, Get, Post, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all reports' })
  async listAll() {
    const reports = await this.reportsService.listAll();
    return { success: true, data: reports };
  }

  @Post(':caseId/generate')
  @ApiOperation({ summary: 'Generate investigation report' })
  async generate(@Param('caseId') caseId: string, @CurrentUser('id') userId: string) {
    const report = await this.reportsService.generate(caseId, userId);
    return { success: true, data: report };
  }

  @Get('investigation/:investigationId/pdf')
  @ApiOperation({ summary: 'Download investigation PDF' })
  async downloadInvestigationPdf(
    @Param('investigationId') investigationId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateInvestigationPdfBuffer(investigationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Forensic_Report_${investigationId.substring(0, 8)}.pdf"`);
    res.send(buffer);
  }

  @Get('investigation/:investigationId/notice')
  @ApiOperation({ summary: 'Download Section 91 CrPC notice PDF' })
  async downloadSection91Notice(
    @Param('investigationId') investigationId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateSection91NoticeBuffer(investigationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Section_91_Notice_${investigationId.substring(0, 8)}.pdf"`);
    res.send(buffer);
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get reports for a case' })
  async findByCase(@Param('caseId') caseId: string) {
    const reports = await this.reportsService.findByCaseId(caseId);
    return { success: true, data: reports };
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify report integrity' })
  async verifyIntegrityGet(@Param('id') id: string) {
    const result = await this.reportsService.verifyIntegrity(id);
    return { success: true, data: result };
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify report integrity' })
  async verifyIntegrityPost(@Param('id') id: string) {
    const result = await this.reportsService.verifyIntegrity(id);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  async findById(@Param('id') id: string) {
    const report = await this.reportsService.findById(id);
    return { success: true, data: report };
  }
}
