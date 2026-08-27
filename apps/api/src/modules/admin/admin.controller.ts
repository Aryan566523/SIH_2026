import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@chainsentinel/types';

@ApiTags('Administration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List all users in organization' })
  async getUsers(@CurrentUser('organizationId') orgId: string) {
    const users = await this.adminService.getUsers(orgId);
    const sanitized = users.map(({ passwordHash, ...rest }: any) => rest);
    return { success: true, data: sanitized };
  }

  @Patch('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user role' })
  async updateRole(@Param('id') id: string, @Body('role') role: string) {
    const user = await this.adminService.updateUserRole(id, role);
    return { success: true, data: user };
  }

  @Patch('users/:id/toggle')
  @Roles(UserRole.SUPER_ADMIN, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Toggle user active status' })
  async toggleActive(@Param('id') id: string) {
    const user = await this.adminService.toggleUserActive(id);
    return { success: true, data: user };
  }

  @Get('organizations')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List organizations' })
  async getOrganizations() {
    const orgs = await this.adminService.getOrganizations();
    return { success: true, data: orgs };
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Get system stats' })
  async getStats() {
    const stats = await this.adminService.getSystemStats();
    return { success: true, data: stats };
  }
}
