import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvestigationsService } from './investigations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Investigations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investigations')
export class InvestigationsController {
  constructor(private invService: InvestigationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create new investigation' })
  async create(
    @CurrentUser() user: any,
    @Body() body: { caseId: string; suspectWallet: string; blockchain?: string },
  ) {
    const inv = await this.invService.create(body);
    return { success: true, data: inv };
  }

  @Get()
  @ApiOperation({ summary: 'List investigations' })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.invService.getAll(orgId, { page, limit });
    return { success: true, ...result };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get investigation statistics' })
  async getStats(@CurrentUser('organizationId') orgId: string) {
    const stats = await this.invService.getStats(orgId);
    return { success: true, data: stats };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get investigation by ID' })
  async findOne(@Param('id') id: string) {
    const inv = await this.invService.findById(id);
    return { success: true, data: inv };
  }

  @Get(':id/jobs')
  @ApiOperation({ summary: 'Get investigation jobs/stages' })
  async getJobs(@Param('id') id: string) {
    const jobs = await this.invService.getJobs(id);
    return { success: true, data: jobs };
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Run or resume an investigation (checkpointed, non-blocking)' })
  async run(@Param('id') id: string) {
    const inv = await this.invService.runOrResume(id);
    return { success: true, data: inv };
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get investigations for a case' })
  async findByCase(@Param('caseId') caseId: string) {
    const invs = await this.invService.findByCaseId(caseId);
    return { success: true, data: invs };
  }
}
