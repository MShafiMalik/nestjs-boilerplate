import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform, Session } from '@prisma/client/index.js';
import { APP_CONSTANTS } from '../../../common/constants/app.constants';
import { DeviceInfoDto } from '../dto/device-info.dto';
import { SessionsRepository } from './sessions.repository';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly configService: ConfigService,
  ) {}

  async createSession(
    userId: string,
    deviceInfo?: DeviceInfoDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Session> {
    const activeCount = await this.sessionsRepository.countActiveByUserId(userId);
    if (activeCount >= APP_CONSTANTS.MAX_SESSIONS_PER_USER) {
      const oldest = await this.sessionsRepository.findOldestActive(userId);
      if (oldest) {
        await this.sessionsRepository.revoke(oldest.id);
      }
    }

    const refreshExpiresIn = this.configService.getOrThrow<string>('jwt.refreshExpiresIn');
    const resolvedUserAgent = deviceInfo?.userAgent ?? userAgent;

    return this.sessionsRepository.create({
      user: { connect: { id: userId } },
      platform: deviceInfo?.platform ?? Platform.WEB,
      deviceId: deviceInfo?.deviceId,
      deviceName: deviceInfo?.deviceName,
      appVersion: deviceInfo?.appVersion,
      osVersion: deviceInfo?.osVersion,
      userAgent: resolvedUserAgent,
      ipAddress,
      lastUsedAt: new Date(),
      expiresAt: this.addDuration(new Date(), refreshExpiresIn),
    });
  }

  async validateSession(sessionId: string): Promise<Session> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session || session.isRevoked) {
      throw new UnauthorizedException('Invalid session');
    }
    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired');
    }
    return session;
  }

  async touch(sessionId: string): Promise<Session> {
    return this.sessionsRepository.update(sessionId, {
      lastUsedAt: new Date(),
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found');
    }
    if (!session.isRevoked) {
      await this.sessionsRepository.revoke(sessionId);
    }
  }

  async revokeAll(userId: string): Promise<void> {
    await this.sessionsRepository.revokeAll(userId);
  }

  async revokeOthers(userId: string, currentSessionId: string): Promise<void> {
    await this.sessionsRepository.revokeOthers(userId, currentSessionId);
  }

  private addDuration(from: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/u.exec(duration.trim());
    if (!match) {
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return new Date(from.getTime() + amount * (multipliers[unit] ?? 86_400_000));
  }
}
