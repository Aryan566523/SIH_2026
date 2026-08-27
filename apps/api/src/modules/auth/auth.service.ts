import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../database/entities/user.entity';
import { Session } from '../../database/entities/session.entity';
import { LoginRequest, AuthTokens, User as UserType } from '@chainsentinel/types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginRequest, userAgent?: string, ipAddress?: string): Promise<{ user: Partial<UserType>; tokens: AuthTokens }> {
    // Normalize email: trim whitespace and lowercase
    const normalizedEmail = (dto.email || '').trim().toLowerCase();

    const user = await this.usersRepo.findOne({
      where: { email: normalizedEmail, isActive: true },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'organizationId', 'passwordHash', 'failedLoginAttempts', 'lockedUntil'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Try again later.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const update: any = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
      }
      await this.usersRepo.update(user.id, update);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Reset failed attempts on success
    await this.usersRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Store session
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await this.sessionsRepo.save({
      userId: user.id,
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      expiresAt: refreshExpiry,
      userAgent,
      ipAddress,
    });

    this.logger.log(`User ${user.email} logged in`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
      },
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const session = await this.sessionsRepo.findOne({
        where: {
          userId: payload.sub,
          isActive: true,
          expiresAt: MoreThan(new Date()),
        },
        select: ['id', 'refreshToken'],
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Invalidate old session (rotation)
      await this.sessionsRepo.update(session.id, { isActive: false });

      // Generate new tokens
      const tokens = await this.generateTokens(payload.sub, payload.email);

      // Create new session
      const refreshExpiry = new Date();
      refreshExpiry.setDate(refreshExpiry.getDate() + 7);

      await this.sessionsRepo.save({
        userId: payload.sub,
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        expiresAt: refreshExpiry,
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.sessionsRepo.update({ userId, isActive: true }, { isActive: false });
    this.logger.log(`User ${userId} logged out`);
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.sessionsRepo.update({ userId, isActive: true }, { isActive: false });
    this.logger.log(`All sessions for user ${userId} terminated`);
  }

  async register(dto: { email: string; password: string; firstName: string; lastName: string; organizationId: string; role?: string }) {
    // Normalize email on registration too
    const normalizedEmail = (dto.email || '').trim().toLowerCase();

    const existing = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.usersRepo.create({
      email: normalizedEmail,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      role: (dto.role as any) || 'INVESTIGATOR',
      organizationId: dto.organizationId,
    });

    const saved = await this.usersRepo.save(user);

    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      role: saved.role,
      organizationId: saved.organizationId,
    };
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
    };
  }
}
