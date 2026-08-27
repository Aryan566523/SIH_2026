import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GraphService } from './graph.service';

@ApiTags('Graph')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('graph')
export class GraphController {
  constructor(private graphService: GraphService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get graph statistics' })
  async getStats() {
    const stats = await this.graphService.getStats();
    return { success: true, data: stats };
  }

  @Post('build')
  @ApiOperation({ summary: 'Build graph for an address' })
  async buildGraph(@Body() body: { address: string; blockchain: string; depth?: number }) {
    const graph = await this.graphService.buildGraphForAddress(
      body.address,
      body.blockchain as any,
      body.depth,
    );
    return { success: true, data: graph };
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get graph for a case' })
  async getCaseGraph(@Param('caseId') caseId: string) {
    const graph = await this.graphService.getCaseGraph(caseId);
    return { success: true, data: graph };
  }

  @Post('trace/forward')
  @ApiOperation({ summary: 'Trace funds forward from an address' })
  async traceForward(@Body() body: { address: string; blockchain: string; maxHops?: number }) {
    const graph = await this.graphService.traceForward(
      body.address,
      body.blockchain as any,
      body.maxHops,
    );
    return { success: true, data: graph };
  }

  @Post('trace/backward')
  @ApiOperation({ summary: 'Trace funds backward to source' })
  async traceBackward(@Body() body: { address: string; blockchain: string; maxHops?: number }) {
    const graph = await this.graphService.traceBackward(
      body.address,
      body.blockchain as any,
      body.maxHops,
    );
    return { success: true, data: graph };
  }
}
