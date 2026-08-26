import request from 'supertest';
import { App } from 'supertest/types';

export function createSessionsApi(server: App) {
  return {
    list: (accessToken: string) =>
      request(server).get('/api/auth/sessions').set('Authorization', `Bearer ${accessToken}`),

    revokeOne: (accessToken: string, sessionId: string) =>
      request(server).delete(`/api/auth/sessions/${sessionId}`).set('Authorization', `Bearer ${accessToken}`),

    revokeOthers: (accessToken: string) =>
      request(server).delete('/api/auth/sessions/others').set('Authorization', `Bearer ${accessToken}`),

    revokeAll: (accessToken: string) =>
      request(server).delete('/api/auth/sessions').set('Authorization', `Bearer ${accessToken}`),
  };
}

export type SessionsApi = ReturnType<typeof createSessionsApi>;
