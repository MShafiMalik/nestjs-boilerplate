import { Role } from '../enums/role.enum';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role | string;
  sessionId: string;
  isEmailVerified: boolean;
};

export type JwtRefreshPayload = {
  sub: string;
  sessionId: string;
};
