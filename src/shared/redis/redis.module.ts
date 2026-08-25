import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
class RedisShutdownService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const password = configService.get<string>('redis.password');

        return new Redis({
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
          password: password ? password : undefined,
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy: (times: number): number | null => {
            if (times > 3) {
              return null;
            }
            return Math.min(times * 50, 200);
          },
        });
      },
    },
    RedisShutdownService,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
