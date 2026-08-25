import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { APP_CONSTANTS } from '../constants/app.constants';
import { ApiSuccessResponse } from '../types/api-response.type';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T> | T> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const path = request.path;

    // Keep Terminus payload shape for load balancer / k8s probes.
    if (path === '/health' || path.endsWith('/health')) {
      return next.handle();
    }

    const requestId = request.requestId ?? String(request.headers[APP_CONSTANTS.REQUEST_ID_HEADER] ?? 'unknown');

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
        requestId,
      })),
    );
  }
}
