import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EvidenceService } from './evidence.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class CreateEvidenceDto {
  @IsIn(['transaction', 'attribution', 'risk_assessment', 'graph_snapshot', 'balance', 'report'])
  kind!: EvidenceKind;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional() @IsString() caseId?: string;
  @IsOptional() @IsString() investigationId?: string;
  @IsOptional() @IsString() walletId?: string;
  @IsOptional() @IsString() refId?: string;
}

type EvidenceKind = 'transaction' | 'attribution' | 'risk_assessment' | 'graph_snapshot' | 'balance' | 'report';

@ApiTags('Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a hash+signed evidence record (append-only)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateEvidenceDto) {
    const record = await this.evidenceService.create({
      kind: dto.kind,
      payload: dto.payload,
      caseId: dto.caseId ?? null,
      investigationId: dto.investigationId ?? null,
      walletId: dto.walletId ?? null,
      refId: dto.refId ?? null,
      createdBy: user?.id ?? null,
      actor: user
        ? { id: user.id, email: user.email, organizationId: user.organizationId }
        : null,
    });
    return { success: true, data: record };
  }

  @Post(':id/correction')
  @ApiOperation({ summary: 'Create a new versioned correction; the original is retained and linked' })
  async createCorrection(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { payload: Record<string, unknown>; reason: string },
  ) {
    const record = await this.evidenceService.createCorrection(
      id,
      body.payload,
      body.reason,
      user ? { id: user.id, email: user.email, organizationId: user.organizationId } : null,
    );
    return { success: true, data: record };
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify SHA-256 hash and signature; flags tamper-suspected on mismatch' })
  async verify(@Param('id') id: string) {
    const outcome = await this.evidenceService.verify(id);
    return { success: true, data: outcome };
  }

  @Get('investigation/:investigationId/verify-package')
  @ApiOperation({ summary: 'Verify all evidence records of an investigation (pre-export integrity check)' })
  async verifyPackage(@Param('investigationId') investigationId: string) {
    const outcome = await this.evidenceService.verifyPackage(investigationId);
    return { success: true, data: outcome };
  }

  @Post(':id/approve-export')
  @ApiOperation({ summary: 'Named investigator approval required before legal/forensic export' })
  async approveExport(@CurrentUser() user: any, @Param('id') id: string) {
    const record = await this.evidenceService.approveForExport(
      id,
      { id: user.id, email: user.email, organizationId: user.organizationId },
    );
    return { success: true, data: record };
  }

  @Get('investigation/:investigationId')
  @ApiOperation({ summary: 'List evidence records for an investigation' })
  async byInvestigation(@Param('investigationId') investigationId: string) {
    const records = await this.evidenceService.findByInvestigation(investigationId);
    return { success: true, data: records };
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'List evidence records for a case' })
  async byCase(@Param('caseId') caseId: string) {
    const records = await this.evidenceService.findByCase(caseId);
    return { success: true, data: records };
  }
}
