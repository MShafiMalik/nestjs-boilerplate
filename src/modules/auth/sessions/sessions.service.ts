import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform, Session } from '@prisma/client/index.js';
import Redis from 'ioredis';
import { APP_CONSTANTS } from '../../../common/constants/app.constants';
import { Platform as PlatformEnum } from '../../../common/enums/platform.enum';
import { REDIS_CLIENT } from '../../../shared/redis/redis.constants';
import { DeviceInfoDto } from '../dto/device-info.dto';
import { DeviceParserService } from './device-parser.service';
import { SessionResponseDto } from './dto/session-response.dto';
import { SessionsRepository } from './sessions.repository';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly configService: ConfigService,
    private readonly deviceParser: DeviceParserService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
    const platform = deviceInfo?.platform ?? Platform.WEB;

    let deviceName = deviceInfo?.deviceName;
    let osVersion = deviceInfo?.osVersion;
    const deviceId = deviceInfo?.deviceId;
    const appVersion = deviceInfo?.appVersion;

    if (platform === Platform.WEB) {
      const parsed = this.deviceParser.parse(resolvedUserAgent);
      deviceName = deviceName ?? parsed.deviceName;
      osVersion = osVersion ?? parsed.osVersion;
    }

    const session = await this.sessionsRepository.create({
      user: { connect: { id: userId } },
      platform,
      deviceId,
      deviceName,
      appVersion,
      osVersion,
      userAgent: resolvedUserAgent,
      ipAddress,
      lastUsedAt: new Date(),
      expiresAt: this.addDuration(new Date(), refreshExpiresIn),
    });

    await this.invalidateCache(userId);
    return session;
  }

  async getSessions(userId: string, currentSessionId: string): Promise<SessionResponseDto[]> {
    const cacheKey = this.cacheKey(userId);
    const cached = await this.redis.get(cacheKey);

    let sessions: Session[];
    if (cached) {
      sessions = this.parseCachedSessions(cached);
    } else {
      sessions = await this.sessionsRepository.findByUserId(userId);
      await this.redis.set(cacheKey, JSON.stringify(sessions), 'EX', APP_CONSTANTS.SESSION_CACHE_TTL);
    }

    return sessions.map((session) => this.toResponseDto(session, currentSessionId));
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
      await this.invalidateCache(userId);
    }
  }

  async revokeAll(userId: string): Promise<void> {
    await this.sessionsRepository.revokeAll(userId);
    await this.invalidateCache(userId);
  }

  async revokeOthers(userId: string, currentSessionId: string): Promise<void> {
    await this.sessionsRepository.revokeOthers(userId, currentSessionId);
    await this.invalidateCache(userId);
  }

  private toResponseDto(session: Session, currentSessionId: string): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.id = session.id;
    dto.platform = session.platform as PlatformEnum;
    dto.deviceId = session.deviceId;
    dto.deviceName = session.deviceName;
    dto.appVersion = session.appVersion;
    dto.osVersion = session.osVersion;
    dto.userAgent = session.userAgent;
    dto.ipAddress = session.ipAddress;
    dto.lastUsedAt = session.lastUsedAt;
    dto.createdAt = session.createdAt;
    dto.isRevoked = session.isRevoked;
    dto.isCurrent = session.id === currentSessionId;
    return dto;
  }

  private parseCachedSessions(cached: string): Session[] {
    const parsed = JSON.parse(cached) as Array<
      Omit<Session, 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'expiresAt'> & {
        createdAt: string;
        updatedAt: string;
        lastUsedAt: string | null;
        expiresAt: string | null;
      }
    >;

    return parsed.map((session) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      lastUsedAt: session.lastUsedAt ? new Date(session.lastUsedAt) : null,
      expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
    }));
  }

  private cacheKey(userId: string): string {
    return `sessions:${userId}`;
  }

  private async invalidateCache(userId: string): Promise<void> {
    await this.redis.del(this.cacheKey(userId));
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
