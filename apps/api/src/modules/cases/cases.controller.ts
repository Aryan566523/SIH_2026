import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CasesService } from './cases.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FraudType, CaseStatus } from '@chainsentinel/types';

@ApiTags('Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cases')
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create new case with complaint' })
  async create(
    @CurrentUser() user: any,
    @Body() body: {
      title: string;
      fraudType: FraudType;
      description?: string;
      complaint?: {
        suspectWalletAddress: string;
        blockchain?: string;
        cryptocurrency?: string;
        estimatedFraudAmount?: string;
        victimReference?: string;
        reportedTimestamp?: string;
        description?: string;
      };
    },
  ) {
    const caseEntity = await this.casesService.create({
      ...body,
      organizationId: user.organizationId,
      createdBy: user.id,
    });
    return { success: true, data: caseEntity };
  }

  @Get()
  @ApiOperation({ summary: 'List cases in organization' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    const result = await this.casesService.findAll(orgId, { page, limit, status });
    return { success: true, ...result };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get case statistics' })
  async getStats(@CurrentUser('organizationId') orgId: string) {
    const stats = await this.casesService.getStats(orgId);
    return { success: true, data: stats };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case by ID' })
  async findOne(@Param('id') id: string) {
    const c = await this.casesService.findById(id);
    return { success: true, data: c };
  }

  @Get(':id/complaints')
  @ApiOperation({ summary: 'Get complaints for a case' })
  async getComplaints(@Param('id') id: string) {
    const complaints = await this.casesService.getComplaints(id);
    return { success: true, data: complaints };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update case status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: CaseStatus,
  ) {
    const c = await this.casesService.updateStatus(id, status);
    return { success: true, data: c };
  }
}
