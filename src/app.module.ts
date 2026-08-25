import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { UtilModule } from './common/util/util.module';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma.module';
import { LoggerModule } from './shared/logger/logger.module';
import { RedisModule } from './shared/redis/redis.module';

@Module({
  imports: [AppConfigModule, PrismaModule, UtilModule, LoggerModule, RedisModule],
  controllers: [AppController],
  providers: [AppService, HttpExceptionFilter, LoggingInterceptor, ResponseInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
