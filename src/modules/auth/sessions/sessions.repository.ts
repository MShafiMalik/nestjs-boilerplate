import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '@prisma/client/index.js';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  findByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  countActiveByUserId(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: { userId, isRevoked: false },
    });
  }

  findOldestActive(userId: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: { userId, isRevoked: false },
      orderBy: { createdAt: 'asc' },
    });
  }

  update(id: string, data: Prisma.SessionUpdateInput): Promise<Session> {
    return this.prisma.session.update({ where: { id }, data });
  }

  revoke(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  revokeAll(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  revokeOthers(userId: string, currentSessionId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
        id: { not: currentSessionId },
      },
      data: { isRevoked: true },
    });
  }

  revokeExpired(): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: {
        isRevoked: false,
        expiresAt: { lt: new Date() },
      },
      data: { isRevoked: true },
    });
  }
}
