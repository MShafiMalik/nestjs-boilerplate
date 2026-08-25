import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggerService } from './shared/logger/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(LoggerService));

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('app.port');
  const corsOrigins = configService.getOrThrow<string[]>('app.corsOrigins');
  const trustProxy = configService.getOrThrow<boolean>('app.trustProxy');

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(app.get(HttpExceptionFilter));
  app.useGlobalInterceptors(app.get(LoggingInterceptor), app.get(ResponseInterceptor));

  if (trustProxy) {
    const httpAdapter = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    httpAdapter.set('trust proxy', 1);
  }

  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
