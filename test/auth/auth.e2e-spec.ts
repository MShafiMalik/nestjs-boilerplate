import request from 'supertest';
import { createAuthApi, registerAndVerify, TEST_PASSWORD } from '../helpers/auth';
import { acquireE2eContext, releaseE2eContext, type E2eContext } from '../helpers/e2e-context';
import { randomToken, sha256, uniqueEmail } from '../helpers/prisma';

describe('Auth (e2e)', () => {
  let ctx: E2eContext;
  let api: ReturnType<typeof createAuthApi>;

  beforeAll(async () => {
    ctx = await acquireE2eContext();
    api = createAuthApi(ctx.server);
  });

  afterAll(async () => {
    process.env.E2E_FORCE_THROTTLE = 'false';
    await releaseE2eContext();
  });

  describe('register', () => {
    it('registers a user without tokens', async () => {
      const email = uniqueEmail('register');

      const response = await api.register({ name: 'E2E User', email, password: TEST_PASSWORD }).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        message: 'Check your email to verify your account',
      });
      expect(response.body.data.accessToken).toBeUndefined();
      expect(response.body.data.refreshToken).toBeUndefined();
    });

    it('rejects duplicate email with different case', async () => {
      const local = `dup-${String(Date.now())}-${randomToken(6)}`;
      const email = `${local}@example.com`;

      await api.register({ name: 'Dup User', email, password: TEST_PASSWORD }).expect(201);

      const response = await api
        .register({
          name: 'Dup User',
          email: `${local.toUpperCase()}@Example.com`,
          password: TEST_PASSWORD,
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('allows re-register after soft-delete frees the email', async () => {
      const email = uniqueEmail('reuse');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      await api.deleteProfile(accessToken).expect(200);

      const response = await api.register({ name: 'Reused Email', email, password: TEST_PASSWORD }).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toEqual(expect.any(String));
    });

    it('rejects weak password', async () => {
      const response = await api
        .register({ name: 'Weak', email: uniqueEmail('weak'), password: 'password' })
        .expect(400);
      expect(response.body.success).toBe(false);
    });

    it('rejects invalid email', async () => {
      const response = await api
        .register({ name: 'Bad Email', email: 'not-an-email', password: TEST_PASSWORD })
        .expect(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('login', () => {
    it('logs in after verification', async () => {
      const email = uniqueEmail('login');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.login({ email, password: TEST_PASSWORD }).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));
      expect(accessToken).toEqual(expect.any(String));
    });

    it('logs in with admin email case variants', async () => {
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD;
      expect(adminEmail).toBeTruthy();
      expect(adminPassword).toBeTruthy();

      const loginEmail = adminEmail === 'admin@example.com' ? 'Admin@Example.com' : String(adminEmail);

      const response = await api.login({ email: loginEmail, password: String(adminPassword) }).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user.email).toBe(adminEmail);
    });

    it('accepts deviceInfo', async () => {
      const email = uniqueEmail('login-device');
      await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api
        .login({
          email,
          password: TEST_PASSWORD,
          deviceInfo: {
            platform: 'IOS',
            deviceId: 'device-2',
            deviceName: 'iPhone',
            appVersion: '1.0.1',
            osVersion: '17',
          },
        })
        .expect(201);

      expect(response.body.data.accessToken).toEqual(expect.any(String));

      const sessions = await ctx.prisma.session.findMany({ where: { user: { email } } });
      expect(sessions.some((session) => session.platform === 'IOS' && session.deviceId === 'device-2')).toBe(true);
    });

    it('rejects login before email verification', async () => {
      const email = uniqueEmail('unverified');

      await api.register({ name: 'Unverified', email, password: TEST_PASSWORD }).expect(201);

      const response = await api.login({ email, password: TEST_PASSWORD }).expect(401);
      expect(response.body.success).toBe(false);
    });

    it('rejects wrong password', async () => {
      const email = uniqueEmail('wrong-pass');
      await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.login({ email, password: 'WrongPass@12345' }).expect(401);
      expect(response.body.success).toBe(false);
    });

    it('rejects unknown email', async () => {
      const response = await api.login({ email: uniqueEmail('unknown'), password: TEST_PASSWORD }).expect(401);
      expect(response.body.success).toBe(false);
    });

    it('rejects inactive users', async () => {
      const email = uniqueEmail('inactive');
      await registerAndVerify(ctx.server, ctx.prisma, email);

      await ctx.prisma.user.update({
        where: { email },
        data: { isActive: false },
      });

      const response = await api.login({ email, password: TEST_PASSWORD }).expect(401);
      expect(response.body.success).toBe(false);
    });

    it('returns 429 when auth throttle is forced', async () => {
      process.env.E2E_FORCE_THROTTLE = 'true';

      try {
        await api.login({ email: uniqueEmail('throttle-1'), password: TEST_PASSWORD }).expect(401);
        await api.login({ email: uniqueEmail('throttle-2'), password: TEST_PASSWORD }).expect(401);
        await api.login({ email: uniqueEmail('throttle-3'), password: TEST_PASSWORD }).expect(401);

        const limited = await api.login({ email: uniqueEmail('throttle-4'), password: TEST_PASSWORD }).expect(429);
        expect(limited.body).toBeDefined();
      } finally {
        process.env.E2E_FORCE_THROTTLE = 'false';
      }
    });
  });

  describe('verify-email', () => {
    it('verifies email and returns tokens', async () => {
      const email = uniqueEmail('verify');

      await api.register({ name: 'Verify User', email, password: TEST_PASSWORD }).expect(201);

      const rawToken = randomToken(48);
      await ctx.prisma.user.update({
        where: { email },
        data: {
          emailVerificationHash: sha256(rawToken),
          emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const response = await api.verifyEmail(rawToken).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));
      expect(response.body.data.user.email).toBe(email);
      expect(response.body.data.user.isEmailVerified).toBe(true);
    });

    it('accepts deviceInfo', async () => {
      const email = uniqueEmail('verify-device');
      await api.register({ name: 'Device User', email, password: TEST_PASSWORD }).expect(201);

      const rawToken = randomToken(48);
      await ctx.prisma.user.update({
        where: { email },
        data: {
          emailVerificationHash: sha256(rawToken),
          emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const response = await api
        .verifyEmail({
          token: rawToken,
          deviceInfo: {
            platform: 'ANDROID',
            deviceId: 'device-1',
            deviceName: 'Pixel',
            appVersion: '1.0.0',
            osVersion: '14',
          },
        })
        .expect(201);

      expect(response.body.data.accessToken).toEqual(expect.any(String));

      const sessions = await ctx.prisma.session.findMany({ where: { user: { email } } });
      expect(sessions.some((session) => session.platform === 'ANDROID' && session.deviceId === 'device-1')).toBe(true);
    });

    it('rejects invalid token', async () => {
      const response = await api.verifyEmail('invalid-verification-token').expect(400);
      expect(response.body.success).toBe(false);
    });

    it('rejects expired token', async () => {
      const email = uniqueEmail('verify-expired');
      await api.register({ name: 'Expired Verify', email, password: TEST_PASSWORD }).expect(201);

      const rawToken = randomToken(48);
      await ctx.prisma.user.update({
        where: { email },
        data: {
          emailVerificationHash: sha256(rawToken),
          emailVerificationExpires: new Date(Date.now() - 60_000),
        },
      });

      const response = await api.verifyEmail(rawToken).expect(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('refresh', () => {
    it('refreshes tokens with a valid refresh token', async () => {
      const email = uniqueEmail('refresh');
      const { refreshToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.refresh(refreshToken).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));
      expect(response.body.data.user.email).toBe(email);
    });

    it('rejects invalid refresh token', async () => {
      const response = await api.refresh('not-a-valid-refresh-token').expect(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('logout', () => {
    it('logs out and rejects the previous access token', async () => {
      const email = uniqueEmail('logout');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.logout(accessToken).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out');

      await api.getProfile(accessToken).expect(401);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server).post('/api/auth/logout').expect(401);
    });

    it('rejects invalid bearer token', async () => {
      await api.logout('not-a-jwt').expect(401);
    });
  });

  describe('profile', () => {
    it('returns verified profile with access token', async () => {
      const email = uniqueEmail('profile');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.getProfile(accessToken).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(email);
      expect(response.body.data.isEmailVerified).toBe(true);
    });

    it('updates profile name', async () => {
      const email = uniqueEmail('update-profile');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.updateProfile(accessToken, { name: 'Updated Name' }).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.email).toBe(email);
    });

    it('deletes account and rejects reused access token', async () => {
      const email = uniqueEmail('delete');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      await api.deleteProfile(accessToken).expect(200);
      await api.getProfile(accessToken).expect(401);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server).get('/api/auth/profile').expect(401);
      await request(ctx.server).patch('/api/auth/profile').send({ name: 'X' }).expect(401);
      await request(ctx.server).delete('/api/auth/profile').expect(401);
    });

    it('rejects invalid bearer token', async () => {
      await api.getProfile('not-a-jwt').expect(401);
    });
  });

  describe('change-password', () => {
    it('changes password and allows login with the new password', async () => {
      const email = uniqueEmail('change-password');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);
      const newPassword = 'NewPass@12345';

      const response = await api
        .changePassword(accessToken, { currentPassword: TEST_PASSWORD, newPassword })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Password changed');

      await api.login({ email, password: TEST_PASSWORD }).expect(401);

      const loginResponse = await api.login({ email, password: newPassword }).expect(201);
      expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
    });

    it('rejects wrong current password', async () => {
      const email = uniqueEmail('change-wrong');
      const { accessToken } = await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api
        .changePassword(accessToken, { currentPassword: 'WrongPass@12345', newPassword: 'NewPass@12345' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('rejects missing bearer token', async () => {
      await request(ctx.server)
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPass@12345' })
        .expect(401);
    });
  });

  describe('forgot-password', () => {
    it('accepts forgot-password for an existing user', async () => {
      const email = uniqueEmail('forgot');
      await registerAndVerify(ctx.server, ctx.prisma, email);

      const response = await api.forgotPassword(email).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('If the email exists, a reset link was sent.');

      const user = await ctx.prisma.user.findUnique({ where: { email } });
      expect(user?.passwordResetHash).toEqual(expect.any(String));
    });

    it('returns generic message for unknown email', async () => {
      const response = await api.forgotPassword(uniqueEmail('forgot-unknown')).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('If the email exists, a reset link was sent.');
    });
  });

  describe('reset-password', () => {
    it('resets password with an arranged reset token', async () => {
      const email = uniqueEmail('reset');
      await registerAndVerify(ctx.server, ctx.prisma, email);

      const rawToken = randomToken(48);
      await ctx.prisma.user.update({
        where: { email },
        data: {
          passwordResetHash: sha256(rawToken),
          passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const newPassword = 'ResetPass@12345';
      const response = await api.resetPassword({ token: rawToken, newPassword }).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Password reset successful');

      const loginResponse = await api.login({ email, password: newPassword }).expect(201);
      expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
    });

    it('rejects invalid token', async () => {
      const response = await api
        .resetPassword({ token: 'invalid-reset-token', newPassword: 'ResetPass@12345' })
        .expect(400);
      expect(response.body.success).toBe(false);
    });

    it('rejects expired token', async () => {
      const email = uniqueEmail('reset-expired');
      await registerAndVerify(ctx.server, ctx.prisma, email);

      const rawToken = randomToken(48);
      await ctx.prisma.user.update({
        where: { email },
        data: {
          passwordResetHash: sha256(rawToken),
          passwordResetExpires: new Date(Date.now() - 60_000),
        },
      });

      const response = await api.resetPassword({ token: rawToken, newPassword: 'ResetPass@12345' }).expect(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('resend-email-verification', () => {
    it('resends email verification after cooldown', async () => {
      const email = uniqueEmail('resend');

      await api.register({ name: 'Resend User', email, password: TEST_PASSWORD }).expect(201);

      await ctx.prisma.user.update({
        where: { email },
        data: {
          emailVerificationSentAt: new Date(Date.now() - 2 * 60 * 1000),
        },
      });

      const response = await api.resendEmailVerification(email).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('If the email exists, a verification link was sent.');

      const user = await ctx.prisma.user.findUnique({ where: { email } });
      expect(user?.emailVerificationHash).toEqual(expect.any(String));
      expect(user?.emailVerificationSentAt?.getTime()).toBeGreaterThan(Date.now() - 60_000);
    });

    it('does not rotate verification hash during cooldown', async () => {
      const email = uniqueEmail('resend-cooldown');
      await api.register({ name: 'Cooldown', email, password: TEST_PASSWORD }).expect(201);

      const before = await ctx.prisma.user.findUnique({ where: { email } });
      expect(before?.emailVerificationHash).toEqual(expect.any(String));
      expect(before?.emailVerificationSentAt).toEqual(expect.any(Date));

      const response = await api.resendEmailVerification(email).expect(201);
      expect(response.body.data.message).toBe('If the email exists, a verification link was sent.');

      const after = await ctx.prisma.user.findUnique({ where: { email } });
      expect(after?.emailVerificationHash).toBe(before?.emailVerificationHash);
      expect(after?.emailVerificationSentAt?.getTime()).toBe(before?.emailVerificationSentAt?.getTime());
    });
  });
});
