import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client/index.js';

export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(length = 48): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${String(Date.now())}-${randomBytes(4).toString('hex')}@example.com`;
}
