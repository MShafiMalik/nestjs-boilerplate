import request from 'supertest';
import Redis from 'ioredis';
import { PrismaService } from '../../src/database/prisma.service';
import { REDIS_CLIENT } from '../../src/shared/redis/redis.constants';
import { acquireE2eContext, releaseE2eContext, type E2eContext } from '../helpers/e2e-context';

describe('Health (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await acquireE2eContext();
  });

  afterAll(async () => {
    await releaseE2eContext();
  });

  describe('GET /health', () => {
    it('returns database and redis up', async () => {
      const response = await request(ctx.server).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.info.database.status).toBe('up');
      expect(response.body.info.redis.status).toBe('up');
      expect(response.body.info.memory_heap.status).toBe('up');
    });

    it('returns 503 when database is down', async () => {
      const prisma = ctx.app.get(PrismaService);
      const spy = jest.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('database unavailable'));

      try {
        const response = await request(ctx.server).get('/health').expect(503);

        expect(response.body.status).toBe('error');
        expect(response.body.error.database.status).toBe('down');
      } finally {
        spy.mockRestore();
      }
    });

    it('returns 503 when redis is down', async () => {
      const redis = ctx.app.get<Redis>(REDIS_CLIENT);
      await redis.quit();

      try {
        const response = await request(ctx.server).get('/health').expect(503);

        expect(response.body.status).toBe('error');
        expect(response.body.error.redis.status).toBe('down');
      } finally {
        await redis.connect();
      }
    });
  });
});
