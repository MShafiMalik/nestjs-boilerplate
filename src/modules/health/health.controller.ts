import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, HealthIndicatorService, MemoryHealthIndicator } from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../shared/redis/redis.constants';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => {
        const indicator = this.healthIndicatorService.check('database');
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return indicator.up();
        } catch (error) {
          return indicator.down({
            message: error instanceof Error ? error.message : 'Database check failed',
          });
        }
      },
      async () => {
        const indicator = this.healthIndicatorService.check('redis');
        try {
          await this.redis.ping();
          return indicator.up();
        } catch (error) {
          return indicator.down({
            message: error instanceof Error ? error.message : 'Redis check failed',
          });
        }
      },
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }
}
