import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/index.js';
import { App } from 'supertest/types';
import { createE2eApp } from './app';
import { cleanupE2eData } from './cleanup';
import { createPrismaClient } from './prisma';

export type E2eContext = {
  app: INestApplication<App>;
  prisma: PrismaClient;
  server: App;
};

let shared: E2eContext | null = null;

async function bootE2eContext(): Promise<E2eContext> {
  const prisma = createPrismaClient();
  await cleanupE2eData(prisma);
  const app = await createE2eApp();

  return {
    app,
    prisma,
    server: app.getHttpServer() as App,
  };
}

/**
 * One Nest app per Jest worker. Pair with `maxWorkers: 1` + `forceExit: true`
 * so suites reuse the same process without re-booting between files.
 */
export async function acquireE2eContext(): Promise<E2eContext> {
  if (!shared) {
    shared = await bootE2eContext();
    return shared;
  }

  await cleanupE2eData(shared.prisma);
  return shared;
}

/** Cleans e2e rows; keeps the shared app alive for the next suite in this worker. */
export async function releaseE2eContext(): Promise<void> {
  if (!shared) {
    return;
  }

  await cleanupE2eData(shared.prisma);
}
