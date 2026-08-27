import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findAll(organizationId: string): Promise<User[]> {
    return this.usersRepo.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
  }

  async update(id: string, updates: any): Promise<User> {
    await this.usersRepo.update(id, updates);
    return this.findById(id);
  }
}
