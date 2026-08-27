import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findById(userId);
    const { passwordHash, ...result } = user as any;
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    const { passwordHash, ...result } = user as any;
    return { success: true, data: result };
  }

  @Get('organization/:orgId')
  @ApiOperation({ summary: 'Get users in organization' })
  async getUsersByOrg(@Param('orgId') orgId: string) {
    const users = await this.usersService.findAll(orgId);
    const sanitized = users.map(({ passwordHash, ...rest }: any) => rest);
    return { success: true, data: sanitized };
  }
}
