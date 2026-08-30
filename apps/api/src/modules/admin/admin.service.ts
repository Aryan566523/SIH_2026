import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Organization } from '../../database/entities/organization.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
  ) {}

  async inviteUser(email: string, role: string, organizationId: string) {
    const user = this.usersRepo.create({
      email,
      role: role as any,
      organizationId,
      firstName: 'Invited',
      lastName: 'User',
      passwordHash: 'pending',
    });
    return this.usersRepo.save(user);
  }

  async getUsers(organizationId: string) {
    return this.usersRepo.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
  }

  async updateUserRole(userId: string, role: string) {
    await this.usersRepo.update(userId, { role: role as any });
    return this.usersRepo.findOne({ where: { id: userId } });
  }

  async toggleUserActive(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (user) {
      await this.usersRepo.update(userId, { isActive: !user.isActive });
    }
    return this.usersRepo.findOne({ where: { id: userId } });
  }

  async getOrganizations() {
    return this.orgRepo.find({ order: { name: 'ASC' } });
  }

  async getSystemStats() {
    const userCount = await this.usersRepo.count();
    const orgCount = await this.orgRepo.count();
    return { userCount, orgCount };
  }
}

