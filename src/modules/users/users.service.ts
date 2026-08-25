import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client/index.js';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPublic, UsersRepository } from './users.repository';

export type SafeUser = Omit<
  UserPublic,
  | 'emailVerificationHash'
  | 'emailVerificationExpires'
  | 'emailVerificationSentAt'
  | 'passwordResetHash'
  | 'passwordResetExpires'
  | 'deletedAt'
>;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toSafeUser(user);
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const user = await this.usersRepository.findByEmail(email);
    return user ? this.toSafeUser(user) : null;
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(email);
  }

  findByPasswordResetHash(hash: string): Promise<User | null> {
    return this.usersRepository.findByPasswordResetHash(hash);
  }

  findByEmailVerificationHash(hash: string): Promise<UserPublic | null> {
    return this.usersRepository.findByEmailVerificationHash(hash);
  }

  async create(data: Prisma.UserCreateInput): Promise<SafeUser> {
    const user = await this.usersRepository.create(data);
    return this.toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.findById(id);
    const user = await this.usersRepository.update(id, dto);
    return this.toSafeUser(user);
  }

  setPasswordReset(id: string, hash: string, expiresAt: Date): Promise<UserPublic> {
    return this.usersRepository.setPasswordReset(id, hash, expiresAt);
  }

  clearPasswordReset(id: string): Promise<UserPublic> {
    return this.usersRepository.clearPasswordReset(id);
  }

  setEmailVerification(id: string, hash: string, expiresAt: Date, sentAt: Date): Promise<UserPublic> {
    return this.usersRepository.setEmailVerification(id, hash, expiresAt, sentAt);
  }

  clearEmailVerification(id: string): Promise<UserPublic> {
    return this.usersRepository.clearEmailVerification(id);
  }

  updatePassword(id: string, hashedPassword: string): Promise<UserPublic> {
    return this.usersRepository.updatePassword(id, hashedPassword);
  }

  async softDelete(id: string, email: string): Promise<SafeUser> {
    const user = await this.usersRepository.softDelete(id, email);
    return this.toSafeUser(user);
  }

  assertActive(user: Pick<UserPublic | User, 'isActive'>): void {
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
  }

  assertEmailVerified(user: Pick<UserPublic | User, 'isEmailVerified'>): void {
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email');
    }
  }

  toSafeUser(user: UserPublic | User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
