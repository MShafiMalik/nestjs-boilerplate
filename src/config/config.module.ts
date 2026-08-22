import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import { validateEnv } from './env.validation';
import jwtConfig from './jwt.config';
import redisConfig from './redis.config';
import throttleConfig from './throttle.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV ?? 'development'}`],
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, throttleConfig],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
