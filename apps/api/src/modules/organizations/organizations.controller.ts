import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations' })
  async findAll() {
    const orgs = await this.orgsService.findAll();
    return { success: true, data: orgs };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string) {
    const org = await this.orgsService.findById(id);
    return { success: true, data: org };
  }

  @Post()
  @ApiOperation({ summary: 'Create organization' })
  async create(@Body() body: { name: string; code: string }) {
    const org = await this.orgsService.create(body);
    return { success: true, data: org };
  }
}
