import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { APP_CONSTANTS } from '../constants/app.constants';
import { ApiErrorResponse } from '../types/api-response.type';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string; headers: Request['headers'] }>();

    const headerRequestId = request.headers[APP_CONSTANTS.REQUEST_ID_HEADER];
    const requestId =
      request.requestId ?? (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId) ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.resolveCode(status);
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? 'Validation failed'
              : exception.message;
        code =
          typeof body.error === 'string' ? body.error.toUpperCase().replaceAll(/\s+/g, '_') : this.resolveCode(status);
        details = Array.isArray(body.message) ? body.message : body.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unhandled exception', String(exception));
    }

    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.status(status).json(payload);
  }

  private resolveCode(status: number): string {
    const statusName = (HttpStatus as unknown as Record<number, string>)[status];
    return statusName || 'INTERNAL_SERVER_ERROR';
  }
}
