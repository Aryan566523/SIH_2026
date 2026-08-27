import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global intelligence search' })
  async search(
    @Query('q') query: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @CurrentUser('organizationId') orgId?: string,
  ) {
    const results = await this.searchService.search(query, type, limit, orgId);
    return { success: true, data: results };
  }
}
