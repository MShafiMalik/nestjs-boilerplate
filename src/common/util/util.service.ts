import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { APP_CONSTANTS } from '../constants/app.constants';
import { PaginatedResponseDto, PaginationMetaDto } from '../dto/pagination-response.dto';

@Injectable()
export class UtilService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, APP_CONSTANTS.SALT_ROUNDS);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  getPaginationParams(page?: number, limit?: number) {
    const normalizedPage = page && page > 0 ? page : APP_CONSTANTS.DEFAULT_PAGE;
    const normalizedLimit = limit && limit > 0 ? Math.min(limit, APP_CONSTANTS.MAX_LIMIT) : APP_CONSTANTS.DEFAULT_LIMIT;

    return {
      page: normalizedPage,
      limit: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
    };
  }

  buildPaginatedResponse<T>(items: T[], totalItems: number, page: number, limit: number): PaginatedResponseDto<T> {
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    const meta = new PaginationMetaDto();
    meta.page = page;
    meta.limit = limit;
    meta.totalItems = totalItems;
    meta.totalPages = totalPages;
    meta.hasNextPage = page < totalPages;
    meta.hasPreviousPage = page > 1 && totalPages > 0;

    const response = new PaginatedResponseDto<T>();
    response.items = items;
    response.meta = meta;
    return response;
  }

  generateRandomString(length = 32): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  generateOtp(length = 6): string {
    const max = 10 ** length;
    const min = 10 ** (length - 1);
    return String(randomInt(min, max));
  }

  addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }

  isExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
    if (!expiresAt) {
      return true;
    }
    return expiresAt.getTime() <= now.getTime();
  }
}
