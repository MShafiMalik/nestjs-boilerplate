import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { LoggerService } from '../../shared/logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `${method} ${originalUrl} ${String(response.statusCode)} +${String(durationMs)}ms`,
            LoggingInterceptor.name,
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - startedAt;
          const status =
            typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
              ? (error as { status: number }).status
              : 500;
          this.logger.error(
            `${method} ${originalUrl} ${String(status)} +${String(durationMs)}ms`,
            undefined,
            LoggingInterceptor.name,
          );
        },
      }),
    );
  }
}
