import { PrismaClient } from '@prisma/client/index.js';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomToken, sha256 } from './prisma';

export const TEST_PASSWORD = 'Test@12345';

type RegisterBody = {
  name: string;
  email: string;
  password: string;
};

type LoginBody = {
  email: string;
  password: string;
  deviceInfo?: {
    platform?: string;
    deviceId?: string;
    deviceName?: string;
    appVersion?: string;
    osVersion?: string;
    userAgent?: string;
  };
};

export function createAuthApi(server: App) {
  return {
    register: (body: RegisterBody) => request(server).post('/api/auth/register').send(body),

    login: (body: LoginBody) => request(server).post('/api/auth/login').send(body),

    refresh: (refreshToken: string) => request(server).post('/api/auth/refresh').send({ refreshToken }),

    logout: (accessToken: string) =>
      request(server).post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`),

    getProfile: (accessToken: string) =>
      request(server).get('/api/auth/profile').set('Authorization', `Bearer ${accessToken}`),

    updateProfile: (accessToken: string, body: { name?: string }) =>
      request(server).patch('/api/auth/profile').set('Authorization', `Bearer ${accessToken}`).send(body),

    deleteProfile: (accessToken: string) =>
      request(server).delete('/api/auth/profile').set('Authorization', `Bearer ${accessToken}`),

    changePassword: (accessToken: string, body: { currentPassword: string; newPassword: string }) =>
      request(server).post('/api/auth/change-password').set('Authorization', `Bearer ${accessToken}`).send(body),

    forgotPassword: (email: string) => request(server).post('/api/auth/forgot-password').send({ email }),

    resetPassword: (body: { token: string; newPassword: string }) =>
      request(server).post('/api/auth/reset-password').send(body),

    verifyEmail: (tokenOrBody: string | { token: string; deviceInfo?: LoginBody['deviceInfo'] }) => {
      const body = typeof tokenOrBody === 'string' ? { token: tokenOrBody } : tokenOrBody;
      return request(server).post('/api/auth/verify-email').send(body);
    },

    resendEmailVerification: (email: string) =>
      request(server).post('/api/auth/resend-email-verification').send({ email }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;

export async function registerAndVerify(
  server: App,
  prisma: PrismaClient,
  email: string,
  name = 'E2E User',
): Promise<{ accessToken: string; refreshToken: string }> {
  const api = createAuthApi(server);

  await api.register({ name, email, password: TEST_PASSWORD }).expect(201);

  const rawToken = randomToken(48);
  await prisma.user.update({
    where: { email },
    data: {
      emailVerificationHash: sha256(rawToken),
      emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const response = await api.verifyEmail(rawToken).expect(201);

  return {
    accessToken: response.body.data.accessToken as string,
    refreshToken: response.body.data.refreshToken as string,
  };
}
