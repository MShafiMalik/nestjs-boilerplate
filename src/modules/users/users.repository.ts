import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client/index.js';
import { PrismaService } from '../../database/prisma.service';

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  emailVerificationHash: true,
  emailVerificationExpires: true,
  emailVerificationSentAt: true,
  passwordResetHash: true,
  passwordResetExpires: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<UserPublic | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userPublicSelect,
    });
  }

  findByEmail(email: string): Promise<UserPublic | null> {
    const normalized = email.trim().toLowerCase();
    return this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
      select: userPublicSelect,
    });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
    });
  }

  findByPasswordResetHash(hash: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        passwordResetHash: hash,
        deletedAt: null,
      },
    });
  }

  findByEmailVerificationHash(hash: string): Promise<UserPublic | null> {
    return this.prisma.user.findFirst({
      where: {
        emailVerificationHash: hash,
        deletedAt: null,
      },
      select: userPublicSelect,
    });
  }

  create(data: Prisma.UserCreateInput): Promise<UserPublic> {
    return this.prisma.user.create({
      data: {
        ...data,
        email: data.email.trim().toLowerCase(),
      },
      select: userPublicSelect,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });
  }

  setPasswordReset(id: string, hash: string, expiresAt: Date): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordResetHash: hash,
        passwordResetExpires: expiresAt,
      },
      select: userPublicSelect,
    });
  }

  clearPasswordReset(id: string): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordResetHash: null,
        passwordResetExpires: null,
      },
      select: userPublicSelect,
    });
  }

  setEmailVerification(id: string, hash: string, expiresAt: Date, sentAt: Date): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data: {
        emailVerificationHash: hash,
        emailVerificationExpires: expiresAt,
        emailVerificationSentAt: sentAt,
      },
      select: userPublicSelect,
    });
  }

  clearEmailVerification(id: string): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data: {
        isEmailVerified: true,
        emailVerificationHash: null,
        emailVerificationExpires: null,
      },
      select: userPublicSelect,
    });
  }

  updatePassword(id: string, hashedPassword: string): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordResetHash: null,
        passwordResetExpires: null,
      },
      select: userPublicSelect,
    });
  }

  softDelete(id: string, email: string): Promise<UserPublic> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `deleted.${id}.${email}`,
      },
      select: userPublicSelect,
    });
  }
}
