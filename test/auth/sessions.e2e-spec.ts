import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createAuthApi, registerAndVerify, TEST_PASSWORD } from '../helpers/auth';
import { acquireE2eContext, releaseE2eContext, type E2eContext } from '../helpers/e2e-context';
import { uniqueEmail } from '../helpers/prisma';
import { createSessionsApi } from '../helpers/sessions';

describe('Sessions (e2e)', () => {
  let ctx: E2eContext;
  let authApi: ReturnType<typeof createAuthApi>;
  let sessionsApi: ReturnType<typeof createSessionsApi>;

  beforeAll(async () => {
    ctx = await acquireE2eContext();
    authApi = createAuthApi(ctx.server);
    sessionsApi = createSessionsApi(ctx.server);
  });

  afterAll(async () => {
    await releaseE2eContext();
  });

  describe('list', () => {
    it('lists sessions and marks the current one', async () => {
      const email = uniqueEmail('sessions-list');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      await authApi.login({ email, password: TEST_PASSWORD }).expect(201);

      const response = await sessionsApi.list(accessToken).expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data.some((session: { isCurrent: boolean }) => session.isCurrent)).toBe(true);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server).get('/api/auth/sessions').expect(401);
    });

    it('rejects invalid bearer token', async () => {
      await sessionsApi.list('not-a-jwt').expect(401);
    });
  });

  describe('revoke one', () => {
    it('revokes a specific session by id', async () => {
      const email = uniqueEmail('sessions-one');
      const first = await registerAndVerify(ctx.server, ctx.prisma, email);
      const secondLogin = await authApi.login({ email, password: TEST_PASSWORD }).expect(201);

      const listResponse = await sessionsApi.list(first.accessToken).expect(200);

      const otherSession = listResponse.body.data.find(
        (session: { isCurrent: boolean; id: string }) => !session.isCurrent,
      ) as { id: string } | undefined;
      expect(otherSession).toEqual(expect.objectContaining({ id: expect.any(String) }));

      const otherSessionId = (otherSession as { id: string }).id;
      const secondAccessToken = secondLogin.body.data.accessToken as string;

      const response = await sessionsApi.revokeOne(first.accessToken, otherSessionId).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Session revoked');

      await authApi.getProfile(secondAccessToken).expect(401);
    });

    it('rejects non-uuid session id', async () => {
      const email = uniqueEmail('sessions-bad-id');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      await request(ctx.server)
        .delete('/api/auth/sessions/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('rejects revoking another users session', async () => {
      const ownerEmail = uniqueEmail('sessions-owner');
      const attackerEmail = uniqueEmail('sessions-attacker');

      const owner = await registerAndVerify(ctx.server, ctx.prisma, ownerEmail);
      const attacker = await registerAndVerify(ctx.server, ctx.prisma, attackerEmail);

      const ownerSessions = await sessionsApi.list(owner.accessToken).expect(200);
      const ownerSessionId = ownerSessions.body.data[0].id as string;

      const response = await sessionsApi.revokeOne(attacker.accessToken, ownerSessionId).expect(403);
      expect(response.body.success).toBe(false);
    });

    it('rejects non-existent session id', async () => {
      const email = uniqueEmail('sessions-missing');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await sessionsApi.revokeOne(accessToken, randomUUID()).expect(403);
      expect(response.body.success).toBe(false);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server).delete(`/api/auth/sessions/${randomUUID()}`).expect(401);
    });

    it('rejects invalid bearer token', async () => {
      await sessionsApi.revokeOne('not-a-jwt', randomUUID()).expect(401);
    });
  });

  describe('revoke others', () => {
    it('revokes other sessions', async () => {
      const email = uniqueEmail('sessions-others');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);
      await authApi.login({ email, password: TEST_PASSWORD }).expect(201);

      const response = await sessionsApi.revokeOthers(accessToken).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Other sessions revoked');

      const listResponse = await sessionsApi.list(accessToken).expect(200);
      const activeSessions = listResponse.body.data.filter((session: { isRevoked: boolean }) => !session.isRevoked);

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].isCurrent).toBe(true);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server).delete('/api/auth/sessions/others').expect(401);
    });

    it('rejects invalid bearer token', async () => {
      await sessionsApi.revokeOthers('not-a-jwt').expect(401);
    });
  });

  describe('revoke all', () => {
    it('revokes all sessions', async () => {
      const email = uniqueEmail('sessions-all');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);
      await authApi.login({ email, password: TEST_PASSWORD }).expect(201);

      const response = await sessionsApi.revokeAll(accessToken).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('All sessions revoked');

      await authApi.getProfile(accessToken).expect(401);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server).delete('/api/auth/sessions').expect(401);
    });

    it('rejects invalid bearer token', async () => {
      await sessionsApi.revokeAll('not-a-jwt').expect(401);
    });
  });
});
