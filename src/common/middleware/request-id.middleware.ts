import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { APP_CONSTANTS } from '../constants/app.constants';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerValue = req.headers[APP_CONSTANTS.REQUEST_ID_HEADER];
    const incomingId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const requestId = typeof incomingId === 'string' && incomingId.trim().length > 0 ? incomingId.trim() : randomUUID();

    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader(APP_CONSTANTS.REQUEST_ID_HEADER, requestId);
    next();
  }
}
