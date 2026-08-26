import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = this.configService.get<string>('app.nodeEnv') ?? 'development';
    const isProduction = nodeEnv === 'production';
    const isE2e = process.env.E2E_TESTING === 'true';

    const consoleFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, context, stack }) => {
        const ctx = typeof context === 'string' && context.length > 0 ? `[${context}] ` : '';
        const stackTrace = typeof stack === 'string' && stack.length > 0 ? `\n${stack}` : '';
        return `${String(timestamp)} ${level}: ${ctx}${String(message)}${stackTrace}`;
      }),
    );

    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: isE2e ? 'error' : isProduction ? 'info' : 'debug',
        format: isProduction ? jsonFormat : consoleFormat,
      }),
    ];

    if (isProduction) {
      const logsDir = join(process.cwd(), 'logs');
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      transports.push(
        new winston.transports.File({
          filename: join(logsDir, 'error.log'),
          level: 'error',
          format: jsonFormat,
        }),
        new winston.transports.File({
          filename: join(logsDir, 'combined.log'),
          format: jsonFormat,
        }),
      );
    }

    this.logger = winston.createLogger({
      levels: winston.config.npm.levels,
      transports,
    });
  }

  log(message: unknown, context?: string): void {
    this.logger.info(this.stringify(message), { context });
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(this.stringify(message), { context, stack: trace });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.stringify(message), { context });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.stringify(message), { context });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(this.stringify(message), { context });
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
