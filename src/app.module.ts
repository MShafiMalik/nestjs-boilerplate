import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { UtilModule } from './common/util/util.module';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma.module';
import { ModulesModule } from './modules/modules.module';
import { LoggerModule } from './shared/logger/logger.module';
import { RedisModule } from './shared/redis/redis.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    UtilModule,
    LoggerModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const skipForE2e = (): boolean =>
          process.env.E2E_TESTING === 'true' && process.env.E2E_FORCE_THROTTLE !== 'true';

        return [
          {
            name: 'default',
            ttl: configService.getOrThrow<number>('throttle.default.ttl'),
            limit: configService.getOrThrow<number>('throttle.default.limit'),
            skipIf: skipForE2e,
          },
          {
            name: 'auth',
            ttl: configService.getOrThrow<number>('throttle.auth.ttl'),
            limit: configService.getOrThrow<number>('throttle.auth.limit'),
            skipIf: skipForE2e,
          },
        ];
      },
    }),
    ModulesModule,
  ],
  providers: [
    HttpExceptionFilter,
    LoggingInterceptor,
    ResponseInterceptor,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
