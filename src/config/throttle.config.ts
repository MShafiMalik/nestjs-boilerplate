import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  default: {
    ttl: Number.parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: Number.parseInt(process.env.THROTTLE_LIMIT ?? '20', 10),
  },
  auth: {
    ttl: Number.parseInt(process.env.THROTTLE_AUTH_TTL_MS ?? '60000', 10),
    limit: Number.parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '5', 10),
  },
}));
